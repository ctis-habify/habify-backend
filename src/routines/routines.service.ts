import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Routine } from './routines.entity';
import type { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';

@Injectable()
export class RoutinesService {
  constructor(
    @InjectRepository(Routine)
    private readonly routineRepo: Repository<Routine>,
  ) {}

  // List routines by user
  async getUserRoutines(userId: string): Promise<Routine[]> {
    return this.routineRepo.find({
      where: { user_id: userId },
      order: { start_time: 'ASC' },
    });
  }

  // create new routine
  async createRoutine(data: { userId: string } & CreateRoutineDto): Promise<Routine> {
    const routine = this.routineRepo.create({
      user_id: data.userId,
      routine_group_id: data.routineGroupId,
      frequency_type: data.frequencyType,
      frequency_detail: data.frequencyDetail ?? null,
      start_time: data.startTime ?? '00:00:00',
      end_time: data.endTime ?? '23:59:59',
      is_ai_verified: false,
    });

    return this.routineRepo.save(routine);
  }
}
