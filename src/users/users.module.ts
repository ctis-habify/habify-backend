import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PersonalRoutineLog } from 'src/routine-logs/routine-logs.entity';
import { FriendRequest } from 'src/friend-requests/friend-requests.entity';
import { PersonalRoutine } from 'src/routines/routines.entity';
import { CollaborativeRoutine } from 'src/routines/collaborative-routines.entity';
import { CollaborativeRoutineMember } from 'src/routines/routine-members.entity';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      User,
      PersonalRoutineLog,
      FriendRequest,
      PersonalRoutine,
      CollaborativeRoutine,
      CollaborativeRoutineMember,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
