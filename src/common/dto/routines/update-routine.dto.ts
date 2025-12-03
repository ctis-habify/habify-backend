import { PartialType } from '@nestjs/swagger';
import { CreateRoutineDto } from './create-routines.dto';

export class UpdateRoutineDto extends PartialType(CreateRoutineDto) {}
