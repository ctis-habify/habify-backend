import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service.js';
import { SchedulerController } from './scheduler.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoutinesModule } from '../routines/routines.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([]),
    RoutinesModule,
    AuditLogsModule,
    NotificationsModule,
  ],

  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
