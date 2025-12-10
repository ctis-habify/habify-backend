import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateXpLogDto {
  @ApiProperty({ example: 50, description: 'Amount of XP earned' })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'completed_routine', description: 'Reason for earning XP' })
  @IsNotEmpty()
  @IsString()
  eventType: string;
}
