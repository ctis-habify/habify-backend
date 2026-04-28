import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollaborativeScore } from './collaborative-score.entity';
import { CollaborativeRoutineMember } from '../routines/routine-members.entity';
import { User } from '../users/users.entity';
import { XpLog } from '../xp-logs/xp-logs.entity';
import { LeaderboardEntryDto } from '../common/dto/collaborative-score/leaderboard-entry.dto';
import { UserCupDto } from '../common/dto/collaborative-score/user-cup.dto';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { ScoreSummaryDto } from '../common/dto/collaborative-score/score-summary.dto';

const CUP_TIER_CONFIG = [
  { tier: 'diamond', label: 'Diamond Cup', minWins: 100, nextMilestone: null },
  { tier: 'gold', label: 'Gold Cup', minWins: 50, nextMilestone: 100 },
  { tier: 'silver', label: 'Silver Cup', minWins: 10, nextMilestone: 50 },
  { tier: 'bronze', label: 'Bronze Cup', minWins: 1, nextMilestone: 10 },
] as const;

const STREAK_BONUS_STEP = 5;
const STREAK_BONUS_POINTS_PER_STEP = 10;

@Injectable()
export class CollaborativeScoreService {
  private readonly logger = new Logger(CollaborativeScoreService.name);

  constructor(
    @InjectRepository(CollaborativeScore)
    private readonly scoreRepository: Repository<CollaborativeScore>,
    @InjectRepository(CollaborativeRoutineMember)
    private readonly memberRepository: Repository<CollaborativeRoutineMember>,
    @InjectRepository(CollaborativeRoutineLog)
    private readonly collaborativeRoutineLogRepository: Repository<CollaborativeRoutineLog>,
    @InjectRepository(XpLog)
    private readonly xpLogRepository: Repository<XpLog>,
  ) {}

  async getScoreSummary(userId: string): Promise<ScoreSummaryDto> {
    const score = await this.syncUserScore(userId);

    const maxStreakResult = await this.memberRepository
      .createQueryBuilder('member')
      .select('COALESCE(MAX(member.streak), 0)', 'maxStreak')
      .where('member.userId = :userId', { userId })
      .getRawOne();

    const currentStreak = parseInt(maxStreakResult?.maxStreak, 10) || 0;

    const cupMap = await this.getCupMapForUsers([userId]);
    const summary = new ScoreSummaryDto();
    summary.totalPoints = score.totalPoints;
    summary.currentStreak = currentStreak;
    summary.nextBonusStreak = this.getNextBonusStreak(currentStreak);
    summary.nextBonusPoints = this.getBonusPointsForStreak(summary.nextBonusStreak);
    summary.cup = cupMap[userId] ?? null;
    summary.cupTier = summary.cup?.tier ?? null;
    return summary;
  }

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

    const userIds = rows.map((row) => row.userId);
    const cupsByUserId = await this.getCupMapForUsers(userIds);

    return rows.map((row, index) => {
      const entry = new LeaderboardEntryDto();
      entry.rank = index + 1;
      entry.userId = row.userId;
      entry.name = row.name;
      entry.username = row.username ?? null;
      entry.avatarUrl = row.avatarUrl ?? null;
      entry.totalPoints = parseInt(row.totalPoints, 10) || 0;
      entry.cup = cupsByUserId[row.userId] ?? null;
      entry.cupTier = entry.cup?.tier ?? null;
      entry.leaderboardMedal = this.getLeaderboardMedal(index + 1);
      return entry;
    });
  }

  async syncUserScore(userId: string): Promise<CollaborativeScore> {
    const collaborativeTypes = [
      'COLLABORATIVE',
      'COLLAB_ROUTINE_MISSED',
      'COLLAB_GROUP_DEFEATED',
      'COLLABORATIVE_STREAK_BONUS',
      'ROUTINE_WINNER',
    ];

    const result = await this.xpLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.amount)', 'total')
      .where('log.userId = :userId', { userId })
      .andWhere('log.eventType IN (:...types)', { types: collaborativeTypes })
      .getRawOne();

    const sum = parseInt(result?.total, 10) || 0;
    const finalScore = Math.max(0, sum);

    const score = await this.findOrCreateScore(userId);
    score.totalPoints = finalScore;

    this.logger.log(
      `Synced collaborative score for user ${userId} from xp_logs. New total: ${score.totalPoints}`,
    );

    return this.scoreRepository.save(score);
  }

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

  async getCupMapForUsers(userIds: string[]): Promise<Record<string, UserCupDto | null>> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return {};
    }

    const approvedLogCounts = await this.collaborativeRoutineLogRepository
      .createQueryBuilder('log')
      .select('log.user_id', 'userId')
      .addSelect('log.collaborative_routine_id', 'routineId')
      .addSelect('COUNT(log.id)', 'approvedCount')
      .where('log.status = :status', { status: 'approved' })
      .groupBy('log.user_id')
      .addGroupBy('log.collaborative_routine_id')
      .getRawMany<{
        userId: string;
        routineId: string;
        approvedCount: string;
      }>();

    const firstPlaceCountsByUserId: Record<string, number> = {};
    const topScoreByRoutineId: Record<string, number> = {};

    for (const row of approvedLogCounts) {
      const approvedCount = parseInt(row.approvedCount, 10) || 0;
      const currentTopScore = topScoreByRoutineId[row.routineId] ?? 0;

      if (approvedCount > currentTopScore) {
        topScoreByRoutineId[row.routineId] = approvedCount;
      }
    }

    for (const row of approvedLogCounts) {
      const approvedCount = parseInt(row.approvedCount, 10) || 0;
      const topScore = topScoreByRoutineId[row.routineId] ?? 0;

      if (approvedCount === 0 || approvedCount !== topScore) {
        continue;
      }

      firstPlaceCountsByUserId[row.userId] = (firstPlaceCountsByUserId[row.userId] ?? 0) + 1;
    }

    return uniqueUserIds.reduce<Record<string, UserCupDto | null>>((result, currentUserId) => {
      const totalFirstPlaceFinishes = firstPlaceCountsByUserId[currentUserId] ?? 0;
      result[currentUserId] = this.buildCupDto(totalFirstPlaceFinishes);
      return result;
    }, {});
  }

  private buildCupDto(totalFirstPlaceFinishes: number): UserCupDto | null {
    const matchingTier = CUP_TIER_CONFIG.find((tier) => totalFirstPlaceFinishes >= tier.minWins);

    if (!matchingTier) {
      return null;
    }

    const cup = new UserCupDto();
    cup.tier = matchingTier.tier;
    cup.label = matchingTier.label;
    cup.totalFirstPlaceFinishes = totalFirstPlaceFinishes;
    cup.nextMilestone = matchingTier.nextMilestone;
    return cup;
  }

  private getLeaderboardMedal(rank: number): string | null {
    switch (rank) {
      case 1:
        return 'gold';
      case 2:
        return 'silver';
      case 3:
        return 'bronze';
      default:
        return null;
    }
  }

  private getNextBonusStreak(currentStreak: number): number {
    const currentStep = Math.floor(Math.max(currentStreak, 0) / STREAK_BONUS_STEP);
    return (currentStep + 1) * STREAK_BONUS_STEP;
  }

  private getBonusPointsForStreak(streak: number): number {
    if (streak < STREAK_BONUS_STEP) {
      return STREAK_BONUS_POINTS_PER_STEP;
    }

    return Math.floor(streak / STREAK_BONUS_STEP) * STREAK_BONUS_POINTS_PER_STEP;
  }
}
