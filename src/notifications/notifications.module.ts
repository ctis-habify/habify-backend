import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { Notification } from './notifications.entity';
import { Routine } from '../routines/routines.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { User } from '../users/users.entity';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Notification, Routine, RoutineLog, User]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
