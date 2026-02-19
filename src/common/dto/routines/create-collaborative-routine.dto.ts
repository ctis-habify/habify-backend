import { IsEnum, IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateRoutineDto } from './create-routines.dto';
import { Gender } from 'src/users/users.entity';

export enum RoutineType {
  personal = 'personal',
  collaborative = 'collaborative',
}

export class CreateCollaborativeRoutineDto extends CreateRoutineDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  categoryId: number;

  @ApiProperty({
    enum: RoutineType,
    example: RoutineType.collaborative,
  })
  @IsEnum(RoutineType)
  @IsOptional()
  routineType?: RoutineType;

  @ApiProperty({ example: 'Must post a photo' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '{"type":"daily"}' })
  @IsString()
  @IsOptional()
  repetition?: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @IsOptional()
  lives?: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({ example: 'Badge' })
  @IsString()
  @IsOptional()
  rewardCondition?: string;

  @ApiProperty({ example: 18, description: 'Minimum age requirement' })
  @IsInt()
  @IsOptional()
  ageRequirement?: number;

  @ApiProperty({ enum: Gender, example: Gender.na, description: 'Gender requirement' })
  @IsEnum(Gender)
  @IsOptional()
  genderRequirement?: Gender;

  @ApiProperty({ example: 100, description: 'Minimum XP requirement' })
  @IsInt()
  @IsOptional()
  xpRequirement?: number;

  @ApiProperty({ example: 10, description: 'XP reward for completing a task' })
  @IsInt()
  @IsOptional()
  completionXp?: number;
}
