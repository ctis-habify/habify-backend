import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateRoutineDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsString()
  frequency: string;

  @IsNotEmpty()
  @IsString()
  repetition: string;

  @IsOptional()
  @IsString()
  status?: string;
}
