import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborativeScore } from './collaborative-score.entity';
import { RoutineMember } from '../routines/routine-members.entity';

@Injectable()
export class CollaborativeScoreService {
  private readonly logger = new Logger(CollaborativeScoreService.name);

  constructor(
    @InjectRepository(CollaborativeScore)
    private readonly scoreRepository: Repository<CollaborativeScore>,
    @InjectRepository(RoutineMember)
    private readonly memberRepository: Repository<RoutineMember>,
  ) {}

  /**
   * Returns the collaborative score summary for a user.
   * total_points: accumulated collaborative points
   * current_streak: max streak across all collaborative routine memberships
   */
  async getScoreSummary(userId: string): Promise<{ totalPoints: number; currentStreak: number }> {
    const score = await this.findOrCreateScore(userId);

    const maxStreakResult = await this.memberRepository
      .createQueryBuilder('member')
      .select('COALESCE(MAX(member.streak), 0)', 'maxStreak')
      .where('member.user_id = :userId', { userId })
      .getRawOne();

    const currentStreak = parseInt(maxStreakResult?.maxStreak, 10) || 0;

    return {
      totalPoints: score.totalPoints,
      currentStreak,
    };
  }

  /**
   * Adds collaborative points to a user's score.
   * Called when a collaborative routine log is verified/approved.
   */
  async addPoints(userId: string, amount: number): Promise<CollaborativeScore> {
    const score = await this.findOrCreateScore(userId);
    score.totalPoints += amount;
    this.logger.log(
      `Adding ${amount} collaborative points to user ${userId}. New total: ${score.totalPoints}`,
    );
    return this.scoreRepository.save(score);
  }

  /**
   * Finds an existing score record or creates a new one for the user.
   */
  async findOrCreateScore(userId: string): Promise<CollaborativeScore> {
    let score = await this.scoreRepository.findOne({ where: { userId } });

    if (!score) {
      score = this.scoreRepository.create({
        userId,
        totalPoints: 0,
      });
      score = await this.scoreRepository.save(score);
    }

    return score;
  }
}
