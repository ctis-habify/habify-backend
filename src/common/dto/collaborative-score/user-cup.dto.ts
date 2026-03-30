import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserCupDto {
  @ApiProperty({ example: 'bronze' })
  tier: string;

  @ApiProperty({ example: 'Bronze Cup' })
  label: string;

  @ApiProperty({ example: 1 })
  totalFirstPlaceFinishes: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  nextMilestone: number | null;
}
