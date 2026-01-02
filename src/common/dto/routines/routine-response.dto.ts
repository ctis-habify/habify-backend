import { ApiProperty } from '@nestjs/swagger';

export class RoutineResponseDto {
  @ApiProperty({ example: 'uuid-1234' })
  id: string;

  @ApiProperty({ example: 'Morning Yoga' })
  title: string;

  @ApiProperty({ example: 'Health' })
  category: string;

  @ApiProperty({ example: '08:00:00' })
  startTime: string;

  @ApiProperty({ example: '08:30:00' })
  endTime: string;

  @ApiProperty({ example: 'Daily' })
  frequency: string;

  @ApiProperty({
    example: false,
    description: 'True if the user has already completed this routine today',
  })
  isCompleted: boolean;

  @ApiProperty({ example: '2 Hours', description: 'Formatted remaining time label' })
  remainingLabel: string;

  @ApiProperty({ example: 5, description: 'Current streak for this routine' })
  streak: number;
}
