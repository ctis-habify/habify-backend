import { PartialType } from '@nestjs/swagger';
import { CreateRoutineDto } from './create-routines.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoutineDto extends PartialType(CreateRoutineDto) {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
