import { ApiProperty } from '@nestjs/swagger';

export class RoutineListInfoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Spor Yap Listesi' })
  title: string;

  @ApiProperty({
    example: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Fitness',
    },
    nullable: true,
  })
  category: {
    id: string;
    name: string;
  } | null;
}

export class RoutineDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  userId: string;

  @ApiProperty({ example: 'Daily', enum: ['Daily', 'Weekly'] })
  frequencyType: string;

  @ApiProperty({ example: 1, nullable: true })
  frequencyDetail: number | null;

  @ApiProperty({ example: '08:00:00' })
  startTime: string;

  @ApiProperty({ example: '09:00:00' })
  endTime: string;

  @ApiProperty({ example: true })
  isAiVerified: boolean;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440003', nullable: true })
  routineGroupId: string | null;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: RoutineListInfoDto, nullable: true })
  routineList: RoutineListInfoDto | null;
}

export class GetRoutinesResponseDto {
  @ApiProperty({ type: [RoutineDto] })
  data: RoutineDto[];

  @ApiProperty({
    example: {
      total: 100,
      page: 1,
      limit: 20,
      totalPages: 5,
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

