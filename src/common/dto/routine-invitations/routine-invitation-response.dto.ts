import { ApiProperty } from '@nestjs/swagger';

export class RoutineInvitationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  routineId: string;

  @ApiProperty()
  routineName: string;

  @ApiProperty()
  fromUserId: string;

  @ApiProperty()
  fromUserName: string;

  @ApiProperty({ nullable: true })
  fromUserAvatarUrl: string | null;

  @ApiProperty()
  toUserId: string;

  @ApiProperty()
  toUserName: string;

  @ApiProperty({ nullable: true })
  toUserAvatarUrl: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}
