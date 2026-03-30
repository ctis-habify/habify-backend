import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserCupDto } from './user-cup.dto';

export class LeaderboardEntryDto {
  @ApiProperty({ description: '1-based leaderboard position' })
  rank: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  username: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ description: 'Total collaborative points' })
  totalPoints: number;

  @ApiPropertyOptional({ type: () => UserCupDto, nullable: true })
  cup: UserCupDto | null;

  @ApiPropertyOptional({ nullable: true })
  cupTier: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Leaderboard medal for top-ranked users' })
  leaderboardMedal: string | null;
}
