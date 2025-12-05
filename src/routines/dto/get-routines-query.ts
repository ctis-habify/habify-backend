import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetRoutinesQueryDto {
  @ApiPropertyOptional({
    description: 'Rutin listesi ID\'sine göre filtrele (routine_list_id)',
  })
  @IsOptional()
  @IsUUID()
  listId?: string;

  @ApiPropertyOptional({
    description: 'Rutin grubu ID\'sine göre filtrele (routine_group_id)',
  })
  @IsOptional()
  @IsUUID()
  routineGroupId?: string;

  @ApiPropertyOptional({
    description: 'Kategoriye göre filtrele (RoutineList.category_id üzerinden)',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Frekans tipi (örneğin: Daily, Weekly)',
    example: 'Daily',
  })
  @IsOptional()
  @IsString()
  frequencyType?: string;

  @ApiPropertyOptional({
    description: 'AI doğrulama durumuna göre filtrele',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAiVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Rutin listesi başlığına göre arama',
    example: 'spor',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sıralama alanı',
    enum: ['startTime', 'endTime', 'createdAt', 'frequencyType'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'startTime' | 'endTime' | 'createdAt' | 'frequencyType';

  @ApiPropertyOptional({
    description: 'Sıralama yönü',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Sayfa numarası', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Sayfa başına kayıt', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
