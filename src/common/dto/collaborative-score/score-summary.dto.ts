import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserCupDto } from './user-cup.dto';

export class ScoreSummaryDto {
  @ApiProperty({ description: 'Total collaborative points' })
  totalPoints: number;

  @ApiProperty({ description: 'Highest current streak across collaborative routines' })
  currentStreak: number;

  @ApiPropertyOptional({ type: () => UserCupDto, nullable: true })
  cup: UserCupDto | null;

  @ApiPropertyOptional({ nullable: true })
  cupTier: string | null;
}
