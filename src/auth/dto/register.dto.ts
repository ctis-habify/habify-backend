import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../users/users.entity';

export class RegisterDto {
  @ApiProperty({ example: 'Sueda Akça' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'sueda@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.FEMALE })
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
