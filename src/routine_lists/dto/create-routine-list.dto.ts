import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; 

export class CreateRoutineListDto {
  @ApiProperty({
    example: 'Sabah Rutinim',
    description: 'Oluşturulacak rutin listesinin başlığı',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    example: 1,
    description: 'Bu listenin ait olduğu kategori IDsi (Int)',
  })
  @IsNotEmpty()
  @IsNumber()
  categoryId: number;
}