import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../users/users.entity';

export class CollaborativeChatMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  routineId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  sentAt: Date;

  @ApiProperty({ type: () => User })
  user: User;
}
