import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitVerificationDto {
  @IsUUID()
  routineId: string;

  @IsString()
  gcsObjectPath: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}
