import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendFriendRequestDto {
  @ApiProperty({ description: 'ID of the user to send the friend request to' })
  @IsNotEmpty()
  @IsUUID()
  toUserId: string;
}
