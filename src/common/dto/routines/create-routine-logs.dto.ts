import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateRoutineLogDto {
  @IsNotEmpty()
  @IsUUID()
  routineId: string;

  @IsNotEmpty()
  @IsDateString()
  logDate: string;

  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @IsString()
  @IsOptional()
  verificationImageUrl?: string;
}
