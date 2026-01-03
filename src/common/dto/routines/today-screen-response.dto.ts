import { ApiProperty } from '@nestjs/swagger';
import { RoutineResponseDto } from './routine-response.dto';

export class TodayScreenResponseDto {
  @ApiProperty({ type: [RoutineResponseDto] })
  routines: RoutineResponseDto[];
}
