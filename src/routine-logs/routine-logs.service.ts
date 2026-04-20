import { Between } from 'typeorm';
import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineLog } from './routine-logs.entity';
import { Routine } from '../routines/routines.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { GcsService } from 'src/storage/gcs.service';
import { AiService } from 'src/ai/ai.service';
import { UsersService } from 'src/users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

const STREAK_BONUS_STEP = 5;
const STREAK_BONUS_POINTS_PER_STEP = 10;

@Injectable()
export class RoutineLogsService {
  private readonly logger = new Logger(RoutineLogsService.name);

  constructor(
    @InjectRepository(RoutineLog)
    private readonly logsRepository: Repository<RoutineLog>,
    @InjectRepository(Routine)
    private readonly routinesRepository: Repository<Routine>,
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
    options?: { preverified?: boolean },
  ): Promise<RoutineLog> {
    const routine = await this.routinesRepository.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }
    if (!verificationImageUrl) {
      throw new BadRequestException('Verification image is required');
    }

    let isVerified = !!options?.preverified;

    if (!isVerified) {
      const signedReadUrl = await this.gcsService.getSignedReadUrl(verificationImageUrl, 600);

      const prompt = routine.routineName ?? 'a photo of the required routine activity';

      //AI VERIFICATION
      const aiResult = await this.aiService.verify({
        imageUrl: signedReadUrl,
        text: prompt,
      });

      if (!aiResult.verified) {
        this.logger.warn(`Routine verification failed for user: ${userId}`);
        throw new BadRequestException('Routine verification failed');
      }

      isVerified = aiResult.verified;
    }
    // 1. Create Routine Log
    const newLog = this.logsRepository.create({
      logDate: new Date(),
      isVerified: isVerified,
      verificationImageUrl: verificationImageUrl, // GCS objectPath
      routine,
      userId,
    });

    const savedLog = await this.logsRepository.save(newLog);

    if (savedLog.isVerified) {
      // 2. Update Routine status for immediate feedback
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      let streakBonusPoints = 0;

      if (routine.lastCompletedDate !== today) {
        if (routine.lastCompletedDate === yesterdayStr) {
          routine.streak += 1;
        } else {
          routine.streak = 1;
        }
      }

      routine.isAiVerified = true;
      routine.lastCompletedDate = today;
      await this.routinesRepository.save(routine);

      // 3. Award XP
      let xpAmount = 15; // default for daily/other
      if (routine.frequencyType?.toLowerCase() === 'weekly') {
        xpAmount = 50;
      }
      await this.xpLogsService.awardXP(userId, xpAmount, 'PERSONAL');

      if (routine.streak > 0 && routine.streak % STREAK_BONUS_STEP === 0) {
        streakBonusPoints = this.getStreakBonusPoints(routine.streak);
        await this.xpLogsService.awardXP(userId, streakBonusPoints, 'PERSONAL_STREAK_BONUS');
      }

      if (streakBonusPoints > 0) {
        try {
          await this.notificationsService.createAndPush({
            userId,
            type: 'streak_bonus',
            title: `${routine.streak}-Day Streak Bonus!`,
            body: `You completed a ${routine.streak}-day streak in "${routine.routineName}" and earned ${streakBonusPoints} bonus XP.`,
            routineId: routine.id,
            data: {
              status: 'streak_bonus_awarded',
              completionStreak: routine.streak,
              streakBonusPoints,
              milestoneDays: routine.streak,
            },
          });
        } catch {
          // best-effort notification
        }
      }

      // Check if ALL active daily routines are done today → update user daily streak
      const allRoutines = await this.routinesRepository.find({ where: { userId, active: true } });
      const dailyRoutines = allRoutines.filter((r) => r.frequencyType.toLowerCase() === 'daily');
      const allDoneToday =
        dailyRoutines.length > 0 && dailyRoutines.every((r) => r.lastCompletedDate === today);

      if (allDoneToday) {
        const user = await this.usersService.findById(userId);
        if (user && user.lastStreakDate !== today) {
          const newStreak = user.lastStreakDate === yesterdayStr ? user.dailyStreak + 1 : 1;
          await this.usersService.setDailyStreak(userId, newStreak, today);
        }
      }
    }

    return savedLog;
  }

  async listLogs(routineId: string, userId: string): Promise<RoutineLog[]> {
    return await this.logsRepository.find({
      where: {
        userId,
        routine: { id: routineId },
      },
      order: { createdAt: 'DESC' },
    });
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

    const logs = await this.logsRepository.find({
      where: {
        userId: userId,
        routine: { id: String(routineId) },
        isVerified: true,
        logDate: Between(new Date(startDate), new Date(endDate)),
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

  private getStreakBonusPoints(streak: number): number {
    if (streak < STREAK_BONUS_STEP) {
      return 0;
    }

    return Math.floor(streak / STREAK_BONUS_STEP) * STREAK_BONUS_POINTS_PER_STEP;
  }
}
