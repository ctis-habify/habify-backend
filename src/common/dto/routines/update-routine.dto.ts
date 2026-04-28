import { PartialType } from '@nestjs/swagger';
import { CreatePersonalRoutineDto } from './create-routines.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePersonalRoutineDto extends PartialType(CreatePersonalRoutineDto) {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
