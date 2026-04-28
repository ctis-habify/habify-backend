export class PersonalRoutineListItemDto {
  id: string;
  routineName: string;
  routineListId: number;
  frequencyType: string;
  startTime: string;
  endTime: string;
  startDate: string;

  remainingMinutes: number;
  remainingLabel: string;
  isDone: boolean;
  streak: number;
}
