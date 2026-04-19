import { ApiProperty } from '@nestjs/swagger';

export class PublicCollaborativeRoutineResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'Morning Run Club' })
  routineName: string;

  @ApiProperty({ example: 'A daily running routine to start your day right', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'Health & Fitness', nullable: true })
  category: string | null;

  @ApiProperty({ example: 1 })
  categoryId: number;

  @ApiProperty({ example: '2024-01-15' })
  startDate: string;

  @ApiProperty({ example: 'daily' })
  frequencyType: string;

  @ApiProperty({ example: 42 })
  memberCount: number;

  @ApiProperty({ example: false })
  isAlreadyMember: boolean;

  @ApiProperty({ example: 18, nullable: true })
  ageRequirement: number | null;

  @ApiProperty({ example: 'female', nullable: true })
  genderRequirement: string | null;

  @ApiProperty({ example: 100, nullable: true })
  xpRequirement: number | null;
}
