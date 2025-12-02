import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetRoutinesQueryDto {
  @ApiPropertyOptional({
    description: 'Sadece belirtilen liste (RoutineList) için rutinler',
  })
  @IsOptional()
  @IsUUID()
  listId?: string;

  @ApiPropertyOptional({
    description: 'Kategoriye göre filtrele (RoutineList.category_id)',
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
    description: 'Liste başlığına göre arama',
    example: 'spor',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sıralama alanı',
    enum: ['startTime', 'createdAt', 'title'],
  })
  @IsOptional()
  @IsString()
  sortBy?: 'startTime' | 'createdAt' | 'title';

  @ApiPropertyOptional({
    description: 'Sıralama yönü',
    enum: ['asc', 'desc'],
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
