import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service.js';
import { SchedulerController } from './scheduler.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoutinesModule } from '../routines/routines.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { XpLogsModule } from '../xp-logs/xp-logs.module';
import { CollaborativeScoreModule } from '../collaborative-score/collaborative-score.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([]),
    RoutinesModule,
    AuditLogsModule,
    NotificationsModule,
    XpLogsModule,
    CollaborativeScoreModule,
  ],

  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
