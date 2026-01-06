import { PartialType } from '@nestjs/swagger';
import { CreateRoutineListDto } from './create-routine-list.dto';

export class UpdateRoutineListDto extends PartialType(CreateRoutineListDto) {}
