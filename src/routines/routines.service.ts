import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, type Repository } from 'typeorm';
import { Routine } from './routines.entity';
import type { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';
import { UpdateRoutineDto } from 'src/common/dto/routines/update-routine.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { RoutineListItemDto } from 'src/common/dto/routines/routine-list-item.dto';

import { Category } from 'src/categories/categories.entity';
import { RoutineList } from 'src/routine_lists/routine_lists.entity';
import { RoutineListWithRoutinesDto } from 'src/common/dto/routines/routine-list-with-routines.dto';
import { RoutineLog } from 'src/routine_logs/routine_logs.entity';
import { RoutineResponseDto } from 'src/common/dto/routines/routine-response.dto';
@Injectable()
export class RoutinesService {
  constructor(
    @InjectRepository(Routine)
    private readonly routineRepo: Repository<Routine>,

    @InjectRepository(RoutineList)
    private readonly routineListRepo: Repository<RoutineList>,

    @InjectRepository(RoutineLog)
    private logRepo: Repository<RoutineLog>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue('routine-status') private readonly routineStatusQueue: Queue,
  ) {}

  // List routines by user
  async getUserRoutines(userId: string): Promise<Routine[]> {
    return this.routineRepo.find({
      where: { user_id: userId },
      order: { start_time: 'ASC' },
    });
  }

  //Get routine by id
  async getRoutineById(userId: string, routineId: string): Promise<Routine> {
    return this.routineRepo.findOne({
      where: { user_id: userId, id: routineId },
    });
  }

  // create new routine
  async createRoutine(data: CreateRoutineDto & { userId: string }): Promise<Routine> {
    const routine = this.routineRepo.create({
      user_id: data.userId,
      routine_list_id: data.routineListId,
      routine_name: data.routineName,
      frequency_type: data.frequencyType,
      frequency_detail: data.frequencyDetail ?? null,
      start_time: data.startTime ?? '00:00:00',
      end_time: data.endTime ?? '23:59:59',
      start_date: data.startDate,
      is_ai_verified: false,
    });

    const saved = await this.routineRepo.save(routine);
    console.log('CREATE ROUTINE DATA >>>', data);
    console.log('CREATE ROUTINE ENTITY >>>', routine);

    // Worker için ilk job
    await this.scheduleStatusJob(saved);

    return saved;
  }

  // update routine
  async updateRoutine(userId: string, routineId: string, dto: UpdateRoutineDto) {
    const routine = await this.routineRepo.findOne({
      where: { id: routineId, user_id: userId },
    });
    if (!routine) {
      throw new NotFoundException('Routine not found or access denied');
    }

    Object.assign(routine, dto);

    switch (routine.frequency_type) {
      case 'daily': {
        if (dto.startTime) routine.start_time = dto.startTime;
        if (dto.endTime) routine.end_time = dto.endTime;
        break;
      }
      case 'weekly': {
        if (dto.startDate) routine.start_date = dto.startDate;
        break;
      }
      default:
        break;
    }

    if (dto.routineName) {
      routine.routine_name = dto.routineName;
    }

    const updated = await this.routineRepo.save(routine);

    await this.scheduleStatusJob(updated);

    return updated;
  }

  async deleteRoutine(userId: string, routineId: string) {
    const found = await this.routineRepo.findOne({
      where: {
        user_id: userId,
        id: routineId,
      },
    });
    if (found) console.log('ROUTINE IS FOUND: ', found.routine_name);
    else {
      return { message: 'ROUTINE IS NOT FOUND!' };
    }

    await this.routineRepo.delete({ id: found.id, user_id: found.user_id });
    return { message: 'Routine deleted successfully' };
  }

  async getAllRoutinesByList(userId: string): Promise<RoutineListWithRoutinesDto[]> {
    const lists = await this.routineListRepo.find({
      where: { userId: userId },
      relations: ['category', 'routines'],
      order: { id: 'ASC' },
    });

    const result: RoutineListWithRoutinesDto[] = [];

    for (const list of lists) {
      const routinesSorted = [...(list.routines ?? [])].sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
      );

      const routineDtos: RoutineListItemDto[] = [];

      for (const routine of routinesSorted) {
        const cacheKey = `routine-status:${routine.id}`;

        let status = await this.cache.get<{ remainingMinutes: number; isDone: boolean }>(
          cacheKey,
        );

        if (!status) {
          const fallback = this.computeRemainingFallback(routine);
          status = fallback;
          await this.cache.set(cacheKey, fallback);
          await this.scheduleStatusJob(routine);
        }

        const remainingLabel = this.formatRemainingLabel(status.remainingMinutes);

        routineDtos.push({
          id: routine.id,
          routineName: routine.routine_name,
          frequencyType: routine.frequency_type,
          startTime: routine.start_time,
          endTime: routine.end_time,
          startDate: routine.start_date,
          remainingMinutes: status.remainingMinutes,
          remainingLabel,
          isDone: status.isDone,
          routineListId: 0,
        });
      }

      result.push({
        routineListId: list.id,
        routineListTitle: list.title,
        categoryId: list.categoryId,
        categoryName: list.category?.name ?? null,
        routines: routineDtos,
      });
    }

    return result;
  }

  private computeRemainingFallback(routine: Routine) {
    const endAt = this.buildEndDateTime(routine);
    const now = new Date();
    const diffMs = endAt.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));
    return { remainingMinutes, isDone: remainingMinutes <= 0 };
  }

  private formatRemainingLabel(remainingMinutes: number): string {
    if (remainingMinutes <= 0) return 'Done';

    if (remainingMinutes >= 60) {
      const hours = Math.ceil(remainingMinutes / 60);
      return `${hours} Hours`;
    }
    return `${remainingMinutes} Minutes`;
  }

  private async scheduleStatusJob(routine: Routine) {
    const endAt = this.buildEndDateTime(routine);

    await this.routineStatusQueue.add(
      'updateRoutineStatus',
      {
        routineId: routine.id,
        endAt: endAt.toISOString(),
      },
      {
        delay: 0,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  // start_date (tarih) + end_time (saat) -> Date
  private buildEndDateTime(routine: Routine): Date {
    // start_date kolonu TypeORM'de 'date' ama entity'de string.
    // 'YYYY-MM-DD' formatında varsayıyorum.
    const [year, month, day] = routine.start_date.split('-').map(Number);
    const [h, m, s] = routine.end_time.split(':').map(Number);

    return new Date(year, month - 1, day, h ?? 0, m ?? 0, s ?? 0, 0);
  }

  async getTodayRoutines(userId: string): Promise<RoutineResponseDto[]> {
    const today = new Date();
    // Normalize today to YYYY-MM-DD string for comparison
    const todayString = today.toISOString().split('T')[0];

    // 1. Calculate Day Index
    const jsDay = today.getDay(); // 0=Sun, 1=Mon, 2=Tue...
    const appDayIndex = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, ... 6=Sun

    // 2. Fetch User's Routines active today
    const allRoutines = await this.routineRepo.find({
      where: {
        user_id: userId,
        start_date: LessThanOrEqual(todayString), // Must have started already
      },
      relations: ['routine_list'], // To get Category/List name
    });

    // 3. Filter for TODAY (Daily OR Matching Week Day)
    const todaysRoutines = allRoutines.filter(routine => {
      if (routine.frequency_type.toLowerCase() === 'daily') return true;
      if (routine.frequency_type.toLowerCase() === 'weekly') {
        // Check if the specific day matches
        return Number(routine.frequency_detail) === appDayIndex;
      }
      return false;
    });

    // 4. Check for completions (Logs) for TODAY
    // We create a start and end of the day to check logs
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todaysLogs = await this.logRepo.find({
      where: {
        userId: userId,
        // Check if logDate is within today's range OR exactly matches todayString
        logDate: Between(startOfDay, endOfDay),
        isVerified: true,
      },
    });

    // Create a Set of completed routine IDs for fast lookup
    const completedRoutineIds = new Set(todaysLogs.map(log => log.routine.id));

    const result = await Promise.all(
      todaysRoutines.map(async routine => {
        // A. Calculate End Time for TODAY
        const [h, m, s] = routine.end_time.split(':').map(Number);
        const endAt = new Date(); // Today
        endAt.setHours(h ?? 0, m ?? 0, s ?? 0, 0);

        // B. Calculate Remaining Minutes
        const now = new Date();
        const diffMs = endAt.getTime() - now.getTime();
        const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

        // C. Format Label (Reusing your existing helper method)
        const remainingLabel = this.formatRemainingLabel(remainingMinutes);

        return {
          id: routine.id,
          title: routine.routine_name,
          category: routine.routine_list?.title || 'General',
          startTime: routine.start_time,
          endTime: routine.end_time,
          frequency: routine.frequency_type,
          isCompleted: completedRoutineIds.has(routine.id),
          remainingLabel: remainingLabel,
        };
      }),
    );

    return result;
  }
}
