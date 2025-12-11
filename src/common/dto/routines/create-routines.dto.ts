import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateRoutineDto {
  @ApiProperty({
    example: '3',
  })
  routineListId: number;

  @ApiProperty({
    example: 'Sport Routine 1',
  })
  routineName: string;

  @ApiProperty({
    example: 'Daily',
  })
  @IsString()
  frequencyType: string;

  @ApiProperty({
    example: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  frequencyDetail?: number;

  @ApiProperty({
    example: '08:00:00',
  })
  @IsString()
  startTime: string;

  @ApiProperty({
    example: '10:00:00',
  })
  @IsString()
  endTime: string;

  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  isAiVerified: boolean;

  @ApiProperty({ example: '10/10/2025' })
  startDate: string;
}
