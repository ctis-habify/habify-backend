export interface CollaborativeRoutineViewDto {
  id: string;
  name: string;
  description: string;
  enrolledUsers: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
  }>;
}
