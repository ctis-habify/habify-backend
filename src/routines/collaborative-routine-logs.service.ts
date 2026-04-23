import { Repository, In, Not, Between } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CollaborativeRoutineLog } from './collaborative-routine-logs.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineMember } from './routine-members.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { GcsService } from 'src/storage/gcs.service';
import { AiService } from 'src/ai/ai.service';
import { UsersService } from 'src/users/users.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { CollaborativeScoreService } from '../collaborative-score/collaborative-score.service';
import { RoutineLeaderboardEntryDto } from '../common/dto/collaborative-score/routine-leaderboard-entry.dto';
import { CollaborativeChatService } from './collaborative-chat.service';
import { shouldIncrementStreak } from './routine-cycle.util';

const STREAK_BONUS_STEP = 5;
const STREAK_BONUS_POINTS_PER_STEP = 10;

@Injectable()
export class CollaborativeRoutineLogsService {
  private readonly logger = new Logger(CollaborativeRoutineLogsService.name);

  constructor(
    @InjectRepository(CollaborativeRoutineLog)
    private readonly logsRepository: Repository<CollaborativeRoutineLog>,
    @InjectRepository(CollaborativeRoutine)
    private readonly routinesRepository: Repository<CollaborativeRoutine>,
    @InjectRepository(RoutineMember)
    private readonly memberRepository: Repository<RoutineMember>,
    private readonly xpLogsService: XpLogsService,
    private readonly gcsService: GcsService,
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly collaborativeScoreService: CollaborativeScoreService,
    private readonly collaborativeChatService: CollaborativeChatService,
  ) {}

  async create(
    routineId: string,
    verificationImageUrl: string,
    userId: string,
    _options?: { preverified?: boolean },
  ): Promise<CollaborativeRoutineLog> {
    const routine = await this.routinesRepository.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Collaborative routine not found');
    }

    // Check membership
    const membership = await this.memberRepository.findOne({
      where: { userId, collaborativeRoutineId: routineId },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this routine group');
    }

    if (!verificationImageUrl) {
      this.logger.warn('CollaborativeRoutineLogsService.create: verificationImageUrl is missing');
      throw new BadRequestException('Verification image is required');
    }
    const memberCount = await this.memberRepository.count({
      where: { collaborativeRoutineId: routineId },
    });
    const requiredApprovals = Math.max(1, memberCount - 1);

    const newLog = this.logsRepository.create({
      logDate: new Date(),
      isVerified: false,
      status: 'pending',
      verificationImageUrl: verificationImageUrl,
      routine,
      userId,
      approvals: [],
      rejections: [],
      requiredApprovals,
    });

    const savedLog = await this.logsRepository.save(newLog);

    return savedLog;
  }

  async getPendingVerifications(userId: string): Promise<Record<string, unknown>[]> {
    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['routine'],
    });

    const routineIds = memberships.map((m) => m.routine.id);

    if (routineIds.length === 0) return [];

    const pendingLogs = await this.logsRepository.find({
      where: {
        routine: { id: In(routineIds) },
        status: 'pending',
        userId: Not(userId),
      },
      relations: ['routine', 'routine.category'],
      order: { createdAt: 'DESC' },
    });

    const results = [];
    for (const log of pendingLogs) {
      const user = await this.usersService.findById(log.userId);
      let signedUrl = log.verificationImageUrl;
      if (signedUrl && !signedUrl.startsWith('http')) {
        try {
          signedUrl = await this.gcsService.getSignedReadUrl(log.verificationImageUrl, 3600);
        } catch {
          /* ignore */
        }
      }

      results.push({
        id: log.id,
        routineId: log.routine.id,
        routineName: log.routine.routineName,
        categoryName: log.routine.category?.name || 'Group',
        verificationImageUrl: signedUrl,
        submittedBy: user?.name,
        submittedByAvatar: user?.avatarUrl,
        createdAt: log.createdAt,
        approvals: await Promise.all(
          (log.approvals || []).map(async (uid) => {
            const u = await this.usersService.findById(uid);
            return { id: uid, name: u?.name || 'Member', avatarUrl: u?.avatarUrl };
          }),
        ),
        rejections: await Promise.all(
          (log.rejections || []).map(async (uid) => {
            const u = await this.usersService.findById(uid);
            return { id: uid, name: u?.name || 'Member', avatarUrl: u?.avatarUrl };
          }),
        ),
      });
    }

    return results;
  }

  async verifyLog(userId: string, logId: number, status: 'approved' | 'rejected') {
    const log = await this.logsRepository.findOne({
      where: { id: logId },
      relations: ['routine', 'routine.members'],
    });

    if (!log) {
      this.logger.warn(`CollaborativeRoutineLogsService.verifyLog: log not found for id ${logId}`);
      throw new NotFoundException('Log not found');
    }
    if (log.status !== 'pending') {
      throw new BadRequestException('This log is already finalized');
    }
    const alreadyApproved = log.approvals || [];
    const alreadyRejected = log.rejections || [];

    if (alreadyApproved.includes(userId) || alreadyRejected.includes(userId)) {
      throw new BadRequestException('You have already voted on this log');
    }

    if (log.userId === userId) throw new ForbiddenException('You cannot verify your own log');

    const membership = await this.memberRepository.findOne({
      where: { userId, collaborativeRoutineId: log.routine.id },
    });

    if (!membership) throw new ForbiddenException('You are not a member of this routine group');

    // Multi-user voting tracking
    if (status === 'approved') {
      log.approvals = [...alreadyApproved, userId];
    } else {
      log.rejections = [...alreadyRejected, userId];
    }

    // Threshold check:
    // - pending logs follow current member count (excluding submitter),
    //   but never below the creation snapshot.
    // - finalized logs keep their snapshot and are not re-opened.
    const currentRequiredApprovals = Math.max(1, (log.routine?.members?.length || 1) - 1);
    const requiredApprovals = Math.max(1, log.requiredApprovals || 1, currentRequiredApprovals);
    const currentApprovals = log.approvals.length;

    const isThresholdMet = currentApprovals >= requiredApprovals;

    // We only update the final status and award XP/streak when the threshold is met
    // OR if someone explicitly rejected.
    const isFirstTimeVerified = isThresholdMet && log.status === 'pending';
    const isFirstTimeRejected = status === 'rejected' && log.status === 'pending';

    if (isFirstTimeVerified) {
      log.status = 'approved';
      log.isVerified = true;
    } else if (isFirstTimeRejected) {
      log.status = 'rejected';
      log.isVerified = false;
    }

    await this.logsRepository.save(log);

    let completionStreak: number | undefined;
    let streakBonusPoints = 0;
    if (isFirstTimeVerified) {
      const submitterMembership = await this.memberRepository.findOne({
        where: { userId: log.userId, collaborativeRoutineId: log.routine.id },
      });

      if (submitterMembership) {
        const today = new Date().toISOString().split('T')[0];

        if (submitterMembership.lastCompletedDate !== today) {
          const increment = shouldIncrementStreak(
            log.routine.frequencyType,
            log.routine.startDate,
            submitterMembership.lastCompletedDate,
            today,
          );

          if (increment) {
            submitterMembership.streak += 1;
          } else {
            submitterMembership.streak = 1;
          }
          submitterMembership.lastCompletedDate = today;
          await this.memberRepository.save(submitterMembership);
        }
        completionStreak = submitterMembership.streak;
      }

      const basePoints = log.routine.completionXp || 10;

      await this.xpLogsService.awardXP(log.userId, basePoints, 'COLLABORATIVE');
      await this.collaborativeScoreService.addPoints(log.userId, basePoints);

      if (completionStreak && completionStreak % STREAK_BONUS_STEP === 0) {
        streakBonusPoints = this.getStreakBonusPoints(completionStreak);
        await this.xpLogsService.awardXP(
          log.userId,
          streakBonusPoints,
          'COLLABORATIVE_STREAK_BONUS',
        );
        await this.collaborativeScoreService.addPoints(log.userId, streakBonusPoints);
      }

      try {
        const submitter = await this.usersService.findById(log.userId);
        await this.collaborativeChatService.sendSystemMessage(
          log.routine.id,
          log.userId,
          `${submitter?.name || 'A member'} completed "${log.routine.routineName}" (${log.approvals.length}/${requiredApprovals} approvals).`,
        );

        if (streakBonusPoints > 0) {
          await this.collaborativeChatService.sendSystemMessage(
            log.routine.id,
            log.userId,
            `${submitter?.name || 'A member'} reached a ${completionStreak}-day streak and earned a ${streakBonusPoints}-point bonus.`,
          );
        }
      } catch {
        // best-effort system chat message
      }
    }

    // Send notification to the submitter
    const verifier = await this.usersService.findById(userId);
    const title = status === 'approved' ? 'Log Approved!' : 'Log Rejected';
    const body = `${verifier?.name || 'Someone'} ${status} your log for "${log.routine.routineName}".`;

    try {
      await this.notificationsService.createAndPush({
        userId: log.userId,
        type: 'verification_result',
        title,
        body,
        collaborativeRoutineId: log.routine.id,
        data: {
          status,
          isCompletedByGroup: isFirstTimeVerified,
          completionStreak: isFirstTimeVerified ? completionStreak || 1 : null,
          awardedPoints: isFirstTimeVerified ? log.routine.completionXp || 10 : 0,
          streakBonusPoints,
        },
      });

      if (isFirstTimeVerified && streakBonusPoints > 0) {
        await this.notificationsService.createAndPush({
          userId: log.userId,
          type: 'streak_bonus',
          title: `${completionStreak}-Day Streak Bonus!`,
          body: `You completed a ${completionStreak}-day streak in "${log.routine.routineName}" and earned ${streakBonusPoints} bonus points.`,
          collaborativeRoutineId: log.routine.id,
          data: {
            status: 'streak_bonus_awarded',
            completionStreak: completionStreak || 0,
            streakBonusPoints,
            milestoneDays: completionStreak || 0,
          },
        });
      }
    } catch {
      // log error but don't fail the verification
    }

    const completedUser = isFirstTimeVerified ? await this.usersService.findById(log.userId) : null;
    return {
      message: `Log ${status} successfully`,
      isCompletedByGroup: isFirstTimeVerified,
      awardedXp: isFirstTimeVerified ? log.routine.completionXp || 10 : 0,
      streakBonusPoints,
      totalAwardedPoints: isFirstTimeVerified
        ? (log.routine.completionXp || 10) + streakBonusPoints
        : 0,
      completionStreak: isFirstTimeVerified ? completionStreak || 1 : undefined,
      completedUserId: isFirstTimeVerified ? log.userId : undefined,
      completedUserName: isFirstTimeVerified ? completedUser?.name || 'Member' : undefined,
    };
  }

  private getStreakBonusPoints(streak: number): number {
    if (streak < STREAK_BONUS_STEP) {
      return 0;
    }

    return Math.floor(streak / STREAK_BONUS_STEP) * STREAK_BONUS_POINTS_PER_STEP;
  }

  async getLogsByRoutine(routineId: string): Promise<Record<string, unknown>[]> {
    const logs = await this.logsRepository.find({
      where: {
        routine: { id: routineId },
      },
      relations: ['routine', 'routine.category', 'routine.members'],
      order: { createdAt: 'DESC' },
    });

    const results = [];
    for (const log of logs) {
      const approvalCount = (log.approvals || []).length;
      const currentRequiredApprovals = Math.max(1, (log.routine?.members?.length || 1) - 1);
      const requiredApprovals =
        log.status === 'pending'
          ? Math.max(1, log.requiredApprovals || 1, currentRequiredApprovals)
          : Math.max(1, log.requiredApprovals || 1, approvalCount);
      const user = await this.usersService.findById(log.userId);
      const submitterMembership = await this.memberRepository.findOne({
        where: { userId: log.userId, collaborativeRoutineId: log.routine.id },
      });
      let signedUrl = log.verificationImageUrl;
      if (signedUrl && !signedUrl.startsWith('http')) {
        try {
          signedUrl = await this.gcsService.getSignedReadUrl(log.verificationImageUrl, 3600);
        } catch {
          /* ignore */
        }
      }
      results.push({
        id: log.id,
        logDate: log.logDate,
        createdAt: log.createdAt,
        isVerified: log.isVerified,
        status: log.status,
        verificationImageUrl: signedUrl,
        routineId: log.routine.id,
        routineName: log.routine.routineName,
        categoryName: log.routine.category?.name || 'Group',
        userId: user?.id,
        userName: user?.name,
        userAvatar: user?.avatarUrl,
        completionXp: log.routine.completionXp || 10,
        submitterStreak: submitterMembership?.streak || 0,
        requiredApprovals,
        approvalCount,
        isCompletedByGroup: log.status === 'approved' && approvalCount >= requiredApprovals,
        approvals: await Promise.all(
          (log.approvals || []).map(async (uid) => {
            const u = await this.usersService.findById(uid);
            return { id: uid, name: u?.name || 'Member', avatarUrl: u?.avatarUrl };
          }),
        ),
        rejections: await Promise.all(
          (log.rejections || []).map(async (uid) => {
            const u = await this.usersService.findById(uid);
            return { id: uid, name: u?.name || 'Member', avatarUrl: u?.avatarUrl };
          }),
        ),
      });
    }

    return results;
  }

  async getApprovedLogCountMapByRoutine(routineId: string): Promise<Record<string, number>> {
    const counts = await this.logsRepository
      .createQueryBuilder('log')
      .select('log.userId', 'userId')
      .addSelect('COUNT(log.id)', 'count')
      .where('log.collaborative_routine_id = :routineId', { routineId })
      .andWhere('log.status = :status', { status: 'approved' })
      .groupBy('log.userId')
      .getRawMany();

    const result: Record<string, number> = {};
    for (const row of counts) {
      result[row.userId] = parseInt(row.count, 10);
    }
    return result;
  }

  async getLeaderboard(routineId: string): Promise<RoutineLeaderboardEntryDto[]> {
    const routine = await this.routinesRepository.findOne({
      where: { id: routineId },
      relations: ['members', 'members.user'],
    });

    if (!routine) {
      throw new NotFoundException('Collaborative routine not found');
    }

    const logCounts = await this.getApprovedLogCountMapByRoutine(routineId);
    const completionXp = routine.completionXp || 10;
    const cupsByUserId = await this.collaborativeScoreService.getCupMapForUsers(
      routine.members.map((member) => member.userId),
    );

    const leaderboard: RoutineLeaderboardEntryDto[] = routine.members.map((member) => {
      const approvedLogs = logCounts[member.userId] || 0;
      const score = approvedLogs * completionXp;

      const entry = new RoutineLeaderboardEntryDto();
      entry.userId = member.userId;
      entry.name = member.user.name;
      entry.username = member.user.username || null;
      entry.avatarUrl = member.user.avatarUrl || null;
      entry.score = score;
      entry.cup = cupsByUserId[member.userId] ?? null;
      entry.cupTier = entry.cup?.tier ?? null;
      return entry;
    });

    // Sort descending by score
    leaderboard.sort((a, b) => b.score - a.score);

    // Assign rank
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
      entry.leaderboardMedal = this.getLeaderboardMedal(entry.rank);
    });

    return leaderboard;
  }

  private getLeaderboardMedal(rank: number): string | null {
    if (rank === 1) {
      return 'gold';
    }
    if (rank === 2) {
      return 'silver';
    }
    if (rank === 3) {
      return 'bronze';
    }
    return null;
  }
  async getCalendarLogs(
    userId: string,
    routineId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ date: string; isDone: boolean }[]> {
    if (!startDate || !endDate) {
      return [];
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const logs = await this.logsRepository.find({
      where: {
        userId: userId,
        routine: { id: routineId },
        status: 'approved',
        logDate: Between(start, end),
      },
      order: { logDate: 'ASC' },
    });

    return logs.map((log) => {
      return {
        date:
          log.logDate instanceof Date
            ? log.logDate.toISOString().split('T')[0]
            : new Date(log.logDate).toISOString().split('T')[0],
        isDone: true,
      };
    });
  }
}
