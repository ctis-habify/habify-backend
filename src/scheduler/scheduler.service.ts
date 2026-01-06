import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Subject } from 'rxjs';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly events$ = new Subject<{ type: string; timestamp: string }>();

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    this.logger.log(
      'Scheduler initialised. Database functions should be managed via Supabase.',
    );
  }

  getEventsObservable() {
    return this.events$.asObservable();
  }

  // Her gece 00:00'da çalışır
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyRollup() {
    this.logger.log('Running job_daily_rollup...');
    try {
      // job_daily_rollup parametre alıyor ama varsayılanı (current_date - 1).
      // Bu yüzden direkt çağırabiliriz.
      await this.dataSource.query('SELECT job_daily_rollup();');
      this.logger.log('job_daily_rollup completed successfully.');
      this.events$.next({
        type: 'DAILY_ROLLUP_COMPLETED',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error running job_daily_rollup', error);
    }
  }

  // Her 5 dakikada bir çalışır
  @Cron('0 */5 * * * *')
  async handleReminderScan() {
    this.logger.log('Running job_reminder_scan...');
    try {
      await this.dataSource.query('SELECT job_reminder_scan();');
      // this.logger.log('job_reminder_scan completed.'); // Reduce logs if frequent
      this.events$.next({
        type: 'REMINDER_SCAN_COMPLETED',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error running job_reminder_scan', error);
    }
  }

  async debugGetRoutines() {
    return this.dataSource.query(
      'SELECT id, routine_name, frequency_type, active, is_ai_verified FROM routines',
    );
  }
}
