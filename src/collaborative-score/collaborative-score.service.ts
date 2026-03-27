import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborativeScore } from './collaborative-score.entity';
import { RoutineMember } from '../routines/routine-members.entity';
import { User } from '../users/users.entity';
import { LeaderboardEntryDto } from '../common/dto/collaborative-score/leaderboard-entry.dto';

@Injectable()
export class CollaborativeScoreService {
  private readonly logger = new Logger(CollaborativeScoreService.name);

  constructor(
    @InjectRepository(CollaborativeScore)
    private readonly scoreRepository: Repository<CollaborativeScore>,
    @InjectRepository(RoutineMember)
    private readonly memberRepository: Repository<RoutineMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
   * Returns the global leaderboard, ranking users by their total collaborative points.
   */
  async getLeaderboard(limit: number = 50): Promise<LeaderboardEntryDto[]> {
    const rows = await this.scoreRepository
      .createQueryBuilder('score')
      .innerJoin(User, 'user', 'user.id = score.user_id')
      .select([
        'score.user_id AS "userId"',
        'score.total_points AS "totalPoints"',
        'user.name AS "name"',
        'user.username AS "username"',
        'user.avatar_url AS "avatarUrl"',
      ])
      .orderBy('score.total_points', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((row, index) => {
      const entry = new LeaderboardEntryDto();
      entry.rank = index + 1;
      entry.userId = row.userId;
      entry.name = row.name;
      entry.username = row.username ?? null;
      entry.avatarUrl = row.avatarUrl ?? null;
      entry.totalPoints = parseInt(row.totalPoints, 10) || 0;
      return entry;
    });
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
