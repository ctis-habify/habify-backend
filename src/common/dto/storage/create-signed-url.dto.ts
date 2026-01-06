import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSignedUrlDto {
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsOptional()
  @IsString()
  ext?: string;
}
