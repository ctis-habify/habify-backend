import { Repository, In, Not } from 'typeorm';
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

    const newLog = this.logsRepository.create({
      logDate: new Date(),
      isVerified: false,
      status: 'pending',
      verificationImageUrl: verificationImageUrl,
      routine,
      userId,
      approvals: [],
      rejections: [],
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

    // Threshold check: All other members must approve (Total - 1)
    const requiredApprovals = Math.max(1, log.routine.members.length - 1);
    const currentApprovals = log.approvals.length;

    const isThresholdMet = currentApprovals >= requiredApprovals;

    // We only update the final status and award XP/streak when the threshold is met
    // OR if someone explicitly rejected (it could also be a threshold for rejection)
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

    if (isFirstTimeVerified) {
      const submitterMembership = await this.memberRepository.findOne({
        where: { userId: log.userId, collaborativeRoutineId: log.routine.id },
      });

      if (submitterMembership) {
        const today = new Date().toISOString().split('T')[0];

        if (submitterMembership.lastCompletedDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (submitterMembership.lastCompletedDate === yesterdayStr) {
            submitterMembership.streak += 1;
          } else {
            submitterMembership.streak = 1;
          }
          submitterMembership.lastCompletedDate = today;
          await this.memberRepository.save(submitterMembership);
        }
      }

      await this.xpLogsService.awardXP(log.userId, log.routine.completionXp || 10);
      await this.collaborativeScoreService.addPoints(log.userId, log.routine.completionXp || 10);
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
      });
    } catch {
      // log error but don't fail the verification
    }

    return { message: `Log ${status} successfully` };
  }

  async getLogsByRoutine(routineId: string): Promise<Record<string, unknown>[]> {
    const logs = await this.logsRepository.find({
      where: {
        routine: { id: routineId },
      },
      relations: ['routine', 'routine.category'],
      order: { logDate: 'DESC' },
    });

    const results = [];
    for (const log of logs) {
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
        logDate: log.logDate,
        isVerified: log.isVerified,
        status: log.status,
        verificationImageUrl: signedUrl,
        routineId: log.routine.id,
        routineName: log.routine.routineName,
        categoryName: log.routine.category?.name || 'Group',
        userId: user?.id,
        userName: user?.name,
        userAvatar: user?.avatarUrl,
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
}
