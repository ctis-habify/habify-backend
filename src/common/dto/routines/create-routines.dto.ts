import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateRoutineDto {
  @ApiProperty({
    example: '1',
  })
  @IsInt()
  @IsOptional()
  routineListId?: number;

  @ApiProperty({
    example: 'Sport Routine 1',
  })
  @IsString()
  routineName: string;

  @ApiProperty({
    example: 'Daily',
  })
  @IsString()
  frequencyType: string;

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
  @IsOptional()
  isAiVerified?: boolean;

  @ApiProperty({ example: '2025-10-10' })
  @IsString()
  startDate: string;
}
