import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export class CreateSignedUrlDto {
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsOptional()
  @IsString()
  ext?: string;

  @ApiPropertyOptional({ example: 1048576, description: 'File size in bytes (max 2 MB)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  fileSize?: number;
}
