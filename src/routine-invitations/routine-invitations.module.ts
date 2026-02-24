import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutineInvitation } from './routine-invitations.entity';
import { RoutineInvitationsService } from './routine-invitations.service';
import { RoutineInvitationsController } from './routine-invitations.controller';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { RoutineMember } from '../routines/routine-members.entity';
import { FriendRequestsModule } from '../friend-requests/friend-requests.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoutineInvitation, CollaborativeRoutine, RoutineMember]),
    FriendRequestsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [RoutineInvitationsController],
  providers: [RoutineInvitationsService],
  exports: [RoutineInvitationsService],
})
export class RoutineInvitationsModule {}
