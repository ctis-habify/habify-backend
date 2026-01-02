import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Subject } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly events$ = new Subject<{ type: string; timestamp: string }>();

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.initializeDbFunctions();
  }

  private async initializeDbFunctions() {
    this.logger.log('Initializing/Updating database functions...');
    try {
      // In development/watch mode, files are in src/
      const functionsDir = path.join(process.cwd(), 'src', 'database', 'functions');

      const dailyRollupPath = path.join(functionsDir, 'job_daily_rollup.sql');
      const reminderScanPath = path.join(functionsDir, 'job_reminder_scan.sql');

      if (fs.existsSync(dailyRollupPath)) {
        const sql = fs.readFileSync(dailyRollupPath, 'utf8');
        await this.dataSource.query(sql);
        this.logger.log('job_daily_rollup function created/updated.');
      } else {
        this.logger.warn(`File not found: ${dailyRollupPath}`);
      }

      if (fs.existsSync(reminderScanPath)) {
        const sql = fs.readFileSync(reminderScanPath, 'utf8');
        await this.dataSource.query(sql);
        this.logger.log('job_reminder_scan function created/updated.');
      } else {
        this.logger.warn(`File not found: ${reminderScanPath}`);
      }
    } catch (error) {
      this.logger.error('Error initializing database functions', error);
    }
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
}
