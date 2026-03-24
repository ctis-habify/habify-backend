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
}
