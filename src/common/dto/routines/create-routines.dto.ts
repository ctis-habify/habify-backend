import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateRoutineDto {
  @ApiProperty({
    description: 'Rutin hangi listeye bağlı',
    example: '3',
  })
  routineGroupId: number;

  @ApiProperty({
    description: 'Daily/Weekly seçimi',
    example: 'Daily',
  })
  @IsString()
  frequencyType: string;

  @ApiProperty({
    description: 'Weekly seçildiyse hangi gün (0=Mon, 6=Sun)',
    example: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  frequencyDetail?: number;

  @ApiProperty({
    description: 'Başlangıç saati',
    example: '08:00:00',
  })
  @IsString()
  startTime: string;

  @ApiProperty({
    description: 'Bitiş saati',
    example: '10:00:00',
  })
  @IsString()
  endTime: string;

  @ApiProperty({
    description: 'AI doğrulaması gerekli mi?',
    example: false,
  })
  @IsBoolean()
  isAiVerified: boolean;
}
