import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendRoutineInvitationDto {
  @ApiProperty({ description: 'ID of the collaborative routine to invite to' })
  @IsNotEmpty()
  @IsUUID()
  routineId: string;

  @ApiProperty({ description: 'ID of the friend to invite' })
  @IsNotEmpty()
  @IsUUID()
  toUserId: string;
}
