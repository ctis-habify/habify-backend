import { ApiProperty } from '@nestjs/swagger';
import { RoutineResponseDto } from './routine-response.dto';

export class TodayScreenResponseDto {
  @ApiProperty({ example: 5, description: 'Current user streak' })
  streak: number;

  @ApiProperty({ type: [RoutineResponseDto] })
  routines: RoutineResponseDto[];
}
