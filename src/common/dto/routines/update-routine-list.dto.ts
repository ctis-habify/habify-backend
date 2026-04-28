import { PartialType } from '@nestjs/swagger';
import { CreatePersonalRoutineListDto } from './create-routine-list.dto';

export class UpdatePersonalRoutineListDto extends PartialType(CreatePersonalRoutineListDto) {}
