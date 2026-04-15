import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserCupDto } from './user-cup.dto';

export class ScoreSummaryDto {
  @ApiProperty({ description: 'Total collaborative points' })
  totalPoints: number;

  @ApiProperty({ description: 'Highest current streak across collaborative routines' })
  currentStreak: number;

  @ApiProperty({
    description: 'Next streak milestone that awards a collaborative bonus',
    example: 5,
  })
  nextBonusStreak: number;

  @ApiProperty({
    description: 'Bonus points that will be awarded at the next streak milestone',
    example: 10,
  })
  nextBonusPoints: number;

  @ApiPropertyOptional({ type: () => UserCupDto, nullable: true })
  cup: UserCupDto | null;

  @ApiPropertyOptional({ nullable: true })
  cupTier: string | null;
}
