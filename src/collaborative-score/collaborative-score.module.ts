import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborativeScore } from './collaborative-score.entity';
import { CollaborativeScoreService } from './collaborative-score.service';
import { CollaborativeScoreController } from './collaborative-score.controller';
import { CollaborativeRoutineMember } from '../routines/routine-members.entity';
import { User } from '../users/users.entity';
import { AuthModule } from '../auth/auth.module';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { XpLog } from '../xp-logs/xp-logs.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([CollaborativeScore, CollaborativeRoutineLog, CollaborativeRoutineMember, User, XpLog]),
  ],
  controllers: [CollaborativeScoreController],
  providers: [CollaborativeScoreService],
  exports: [CollaborativeScoreService],
})
export class CollaborativeScoreModule {}
