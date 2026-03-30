import { ApiProperty } from '@nestjs/swagger';
import { UserCupDto } from '../collaborative-score/user-cup.dto';

class ParticipantDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  role: string;

  @ApiProperty()
  streak: number;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty({ type: () => UserCupDto, nullable: true })
  cup: UserCupDto | null;

  @ApiProperty({ nullable: true })
  cupTier: string | null;
}

class GroupRulesDto {
  @ApiProperty()
  lives: number;

  @ApiProperty()
  reward: string;

  @ApiProperty()
  frequency: string;

  @ApiProperty()
  time: string;
}

export class GroupDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  rules: GroupRulesDto;

  @ApiProperty()
  inviteKey: string;

  @ApiProperty()
  memberCount: number;

  @ApiProperty({ type: [ParticipantDto] })
  participants: ParticipantDto[];
}
