import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Sport',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'personal',
    enum: ['personal', 'collaborative'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['personal', 'collaborative'])
  type?: 'personal' | 'collaborative';
}
