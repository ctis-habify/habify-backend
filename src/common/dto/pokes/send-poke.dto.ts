import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendPokeDto {
  @ApiProperty({ description: 'ID of the user to poke' })
  @IsNotEmpty()
  @IsUUID()
  toUserId: string;

  @ApiProperty({ description: 'ID of the collaborative routine you share' })
  @IsNotEmpty()
  @IsUUID()
  collaborativeRoutineId: string;
}
