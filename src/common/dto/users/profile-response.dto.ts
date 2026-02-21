import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'Sueda Akça' })
  name: string;

  @ApiProperty({ example: 'sueda@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 23, nullable: true })
  age: number | null;

  @ApiPropertyOptional({ example: 'https://storage.example.com/avatar.jpg', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 1250 })
  totalXp: number;
}
