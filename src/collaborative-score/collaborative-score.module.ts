import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborativeScore } from './collaborative-score.entity';
import { CollaborativeScoreService } from './collaborative-score.service';
import { CollaborativeScoreController } from './collaborative-score.controller';
import { RoutineMember } from '../routines/routine-members.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([CollaborativeScore, RoutineMember])],
  controllers: [CollaborativeScoreController],
  providers: [CollaborativeScoreService],
  exports: [CollaborativeScoreService],
})
export class CollaborativeScoreModule {}
