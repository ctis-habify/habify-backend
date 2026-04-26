import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Subject, Observable } from 'rxjs';
import { RoutinePenaltyService } from '../routines/routine-penalty.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { CollaborativeScoreService } from '../collaborative-score/collaborative-score.service';

const WINNER_BONUS_XP = 50;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly events$ = new Subject<{ type: string; timestamp: string }>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly routinePenaltyService: RoutinePenaltyService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly xpLogsService: XpLogsService,
    private readonly collaborativeScoreService: CollaborativeScoreService,
  ) {}

  getEventsObservable(): Observable<{ type: string; timestamp: string }> {
    return this.events$.asObservable();
  }

  // Her gece 00:00'da çalışır
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyRollup(): Promise<void> {
    try {
      await this.dataSource.query('SELECT job_daily_rollup();');
      await this.routinePenaltyService.checkAndApplyPenalties();
      await this.checkAndRewardConcludedRoutines();

      this.events$.next({
        type: 'DAILY_ROLLUP_COMPLETED',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error running job_daily_rollup', error);
    }
  }

  /**
   * Finds collaborative routines whose endDate was yesterday, determines the
   * top-performing member (most approved logs), awards them bonus XP and
   * collaborative points, then notifies all participants.
   */
  async checkAndRewardConcludedRoutines(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const concluded = await this.dataSource.query<{ id: string; routineName: string }[]>(
      `SELECT id, routine_name AS "routineName" FROM collaborative_routines WHERE end_date = $1`,
      [yesterdayStr],
    );

    if (concluded.length === 0) return;

    this.logger.log(`Processing ${concluded.length} concluded routine(s) for ${yesterdayStr}`);

    for (const routine of concluded) {
      const top = await this.dataSource.query<{ userId: string }[]>(
        `SELECT user_id AS "userId"
         FROM collaborative_routine_logs
         WHERE collaborative_routine_id = $1 AND status = 'approved'
         GROUP BY user_id
         ORDER BY COUNT(*) DESC
         LIMIT 1`,
        [routine.id],
      );

      if (top.length === 0) {
        this.logger.log(`Routine ${routine.id} concluded with no approved logs — skipping reward`);
        continue;
      }

      const winnerId = top[0].userId;

      await this.xpLogsService.awardXP(winnerId, WINNER_BONUS_XP, 'ROUTINE_WINNER');
      await this.collaborativeScoreService.addPoints(winnerId, WINNER_BONUS_XP);

      await this.notificationsService.createAndPush({
        userId: winnerId,
        type: 'REWARD',
        title: '🏆 Routine Winner!',
        body: `You ranked 1st in "${routine.routineName}" and earned ${WINNER_BONUS_XP} bonus XP!`,
        collaborativeRoutineId: routine.id,
      });

      const otherMembers = await this.dataSource.query<{ userId: string }[]>(
        `SELECT user_id AS "userId" FROM routine_members WHERE collaborative_routine_id = $1 AND user_id != $2`,
        [routine.id, winnerId],
      );

      for (const member of otherMembers) {
        await this.notificationsService.createAndPush({
          userId: member.userId,
          type: 'ROUTINE_CONCLUDED',
          title: 'Routine Concluded',
          body: `The collaborative routine "${routine.routineName}" has ended. Check the leaderboard for final results!`,
          collaborativeRoutineId: routine.id,
        });
      }

      this.logger.log(`Routine ${routine.id} concluded — winner: ${winnerId}`);
    }
  }

  // Her gece 02:00'de audit log temizliği yapar
  @Cron('0 0 2 * * *')
  async handleAuditLogCleanup(): Promise<void> {
    try {
      await this.auditLogsService.cleanup();
    } catch (error) {
      this.logger.error('Error running audit log cleanup', error);
    }
  }

  @Cron('0 0 3 * * *')
  async handleNotificationCleanup(): Promise<void> {
    try {
      await this.notificationsService.cleanup();
    } catch (error) {
      this.logger.error('Error running notification cleanup', error);
    }
  }
}
