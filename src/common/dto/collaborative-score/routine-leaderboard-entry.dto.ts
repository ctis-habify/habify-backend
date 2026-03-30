import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserCupDto } from './user-cup.dto';

export class RoutineLeaderboardEntryDto {
  @ApiProperty({ example: 1, description: 'Rank of the user in this routine' })
  rank: number;

  @ApiProperty({ example: 'uuid', description: 'User ID' })
  userId: string;

  @ApiProperty({ example: 'John Doe', description: 'User Name' })
  name: string;

  @ApiProperty({ example: 'johndoe', description: 'Username', required: false, nullable: true })
  username: string | null;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    description: 'User avatar URL',
    required: false,
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({ example: 150, description: 'Score in this routine' })
  score: number;

  @ApiProperty({ type: () => UserCupDto, nullable: true })
  cup: UserCupDto | null;

  @ApiPropertyOptional({ nullable: true })
  cupTier: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Leaderboard medal for top-ranked users' })
  leaderboardMedal: string | null;
}
