import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Routine } from './routines.entity';
import type { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';
import { UpdateRoutineDto } from 'src/common/dto/routines/update-routine.dto';

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

  // update routine
  async updateRoutine(userId: string, routineId: string, dto: UpdateRoutineDto) {
    const routine = await this.routineRepo.findOne({
      where: { id: routineId, user_id: userId },
    });
    if (!routine) throw new NotFoundException('Routine not found or access denied');

    Object.assign(routine, dto);
    //if (dto.startDate) routine.startDate = new Date(dto.startDate); // In Create Routine DTO, startDate is not exist

    return this.routineRepo.save(routine);
  }

  // delete routine
  async deleteRoutine(userId: string, routineId: string) {
    const result = await this.routineRepo.delete({ id: routineId, user_id: userId });
    if (result.affected === 0)
      throw new NotFoundException('Routine not found or access denied');
    return { message: 'Routine deleted successfully' };
  }
}
