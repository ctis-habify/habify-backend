import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, type Repository } from 'typeorm';
import { Routine } from './routines.entity';
import type { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';
import { UpdateRoutineDto } from 'src/common/dto/routines/update-routine.dto';
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
      start_time: data.startTime ?? '00:00:00',
      end_time: data.endTime ?? '23:59:59',
      start_date: data.startDate,
      is_ai_verified: false,
    });

    const saved = await this.routineRepo.save(routine);
    console.log('CREATE ROUTINE DATA >>>', data);
    console.log('CREATE ROUTINE ENTITY >>>', routine);

    // Worker için ilk job
    // await this.scheduleStatusJob(saved);

    return saved;
  }

  // update routine
  async updateRoutine(userId: string, routineId: string, dto: UpdateRoutineDto) {
    console.log('ROUTINE UPDATED: ', dto);
    console.log('ROUTINE ID: ', routineId);
    const routine = await this.routineRepo.findOne({
      where: { id: routineId, user_id: userId },
    });
    if (!routine) {
      throw new NotFoundException('Routine not found or access denied');
    }
    Object.assign(routine, dto);
    if (dto.startTime) routine.start_time = dto.startTime;
    if (dto.endTime) routine.end_time = dto.endTime;

    switch (routine.frequency_type) {
      case 'daily': {
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
    // await this.scheduleStatusJob(updated);
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
        // Recalculate remaining minutes based on frequency logic
        const now = new Date();
        let endAt = new Date();
        const [h, m, s] = routine.end_time.split(':').map(Number);

        let isWeeklyPending = false;

        const frequencyLower = routine.frequency_type.toLowerCase();

        if (frequencyLower === 'weekly') {
          // Weekly: Reset every 7 days from start_date
          // Parse start_date (YYYY-MM-DD)
          const [sy, sm, sd] = routine.start_date.split('-').map(Number);
          const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);

          // Calculate days passed since start
          const diffTime = now.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          // Current cycle index (0 for first week, 1 for second...)
          // If diffDays is negative (future start), cycle is 0
          const currentCycleIndex = diffDays >= 0 ? Math.floor(diffDays / 7) : 0;

          // Calculate which day of the cycle we are in (0-6)
          const currentCycleDay = diffDays >= 0 ? diffDays % 7 : 0;

          // If we are NOT in the 7th day (index 6), it is pending
          if (currentCycleDay < 6) {
            isWeeklyPending = true;
          }

          // Target day is the 7th day of the current cycle (Start + index*7 + 6 days)
          // Weekly deadline is always 23:59:59 on the 7th day
          const daysToAdd = currentCycleIndex * 7 + 6;

          endAt = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          endAt.setHours(23, 59, 59, 999);
        } else {
          // Daily (or others treated as daily): Reset every day after 00:00
          // Target is Today at end_time
          endAt = new Date(); // Today
          endAt.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
        }

        const diffMs = endAt.getTime() - now.getTime();
        const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

        let remainingLabel = '';

        if (frequencyLower === 'weekly' && isWeeklyPending && remainingMinutes > 0) {
          remainingLabel = 'Pending';
        } else {
          if (remainingMinutes > 1440) {
            // More than 24 hours (Daily case or fail-safe)
            const remainingDays = Math.ceil(remainingMinutes / 1440);
            remainingLabel = `${remainingDays} Days`;
          } else {
            remainingLabel = this.formatRemainingLabel(remainingMinutes);
          }
        }
        const isDone = routine.is_ai_verified;

        if (remainingMinutes <= 0 && !isDone) {
          remainingLabel = 'Failed';
        }

        routineDtos.push({
          id: routine.id,
          routineName: routine.routine_name,
          frequencyType: routine.frequency_type,
          startTime: routine.start_time,
          endTime: routine.end_time,
          startDate: routine.start_date,
          remainingMinutes: remainingMinutes,
          remainingLabel,
          isDone: isDone,
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

  private formatRemainingLabel(remainingMinutes: number): string {
    if (remainingMinutes <= 0) return 'Done';

    if (remainingMinutes >= 60) {
      const hours = Math.ceil(remainingMinutes / 60);
      return `${hours} Hours`;
    }
    return `${remainingMinutes} Minutes`;
  }

  async getTodayRoutines(userId: string): Promise<RoutineResponseDto[]> {
    const today = new Date();
    // Normalize today to YYYY-MM-DD string for comparison
    const todayString = today.toISOString().split('T')[0];

    // 1. Calculate Day Index

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
        return true;
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
      relations: ['routine'],
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

        let remainingLabel = '';

        if (routine.frequency_type.toLowerCase() === 'weekly') {
          const [sy, sm, sd] = routine.start_date.split('-').map(Number);
          const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);

          const diffTime = now.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          const currentCycleDay = diffDays >= 0 ? diffDays % 7 : 0;

          // If we are NOT in the 7th day (index 6), it is pending
          if (currentCycleDay < 6) {
            remainingLabel = 'Pending';
          }
        }

        if (!remainingLabel) {
          remainingLabel = this.formatRemainingLabel(remainingMinutes);
        }

        return {
          id: routine.id,
          title: routine.routine_name,
          category: routine.routine_list?.title || 'General',
          startTime: routine.start_time,
          endTime: routine.end_time,
          frequency: routine.frequency_type,
          isCompleted: completedRoutineIds.has(routine.id),
          remainingLabel: remainingLabel,
          streak: routine.streak,
        };
      }),
    );

    return result;
  }
}
