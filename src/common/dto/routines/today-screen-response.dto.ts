import { ApiProperty } from '@nestjs/swagger';
import { PersonalRoutineResponseDto } from './routine-response.dto';

export class TodayScreenResponseDto {
  @ApiProperty({ type: [PersonalRoutineResponseDto] })
  routines: PersonalRoutineResponseDto[];

  @ApiProperty({ example: 5 })
  streak: number;
}
