import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from 'src/users/users.entity';

export class RegisterDto {
  @ApiProperty({ example: 'Sueda Akça' })
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'sueda_akca', description: 'Unique username for friend search' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'sueda@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.female })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '2002-05-10' })
  @IsOptional()
  @IsDateString()
  birthDate?: Date;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
