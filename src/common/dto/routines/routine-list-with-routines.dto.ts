import { PersonalRoutineListItemDto } from './routine-list-item.dto';

export class PersonalRoutineListWithRoutinesDto {
  routineListId: number;
  routineListTitle: string;

  categoryId: number;
  categoryName: string | null;

  routines: PersonalRoutineListItemDto[];
}
