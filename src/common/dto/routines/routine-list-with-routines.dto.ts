// routine-list-with-routines.dto.ts
import { RoutineListItemDto } from './routine-list-item.dto';

export class RoutineListWithRoutinesDto {
  routineListId: number;
  routineListTitle: string;

  categoryId: number;
  categoryName: string | null;

  routines: RoutineListItemDto[];
}
