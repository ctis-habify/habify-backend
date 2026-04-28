import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborativeRoutineInvitation } from './routine-invitations.entity';
import { CollaborativeRoutineInvitationsService } from './routine-invitations.service';
import { CollaborativeRoutineInvitationsController } from './routine-invitations.controller';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { CollaborativeRoutineMember } from '../routines/routine-members.entity';
import { FriendRequestsModule } from '../friend-requests/friend-requests.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollaborativeRoutineInvitation, CollaborativeRoutine, CollaborativeRoutineMember]),
    FriendRequestsModule,
    UsersModule,
    AuthModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [CollaborativeRoutineInvitationsController],
  providers: [CollaborativeRoutineInvitationsService],
  exports: [CollaborativeRoutineInvitationsService],
})
export class CollaborativeRoutineInvitationsModule {}
