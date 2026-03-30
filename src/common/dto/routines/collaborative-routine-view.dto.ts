import type { UserCupDto } from '../collaborative-score/user-cup.dto';

export interface CollaborativeRoutineViewDto {
  id: string;
  name: string;
  description: string;
  enrolledUsers: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    cup: UserCupDto | null;
    cupTier: string | null;
  }>;
}
