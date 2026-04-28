import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './notifications.entity';
import { PersonalRoutine } from '../routines/routines.entity';
import { PersonalRoutineLog } from '../routine-logs/routine-logs.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { CollaborativeRoutineMember } from '../routines/routine-members.entity';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { User } from '../users/users.entity';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      Notification,
      PersonalRoutine,
      PersonalRoutineLog,
      CollaborativeRoutine,
      CollaborativeRoutineMember,
      CollaborativeRoutineLog,
      User,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
