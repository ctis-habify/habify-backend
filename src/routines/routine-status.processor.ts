// routine-status.processor.ts
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

interface RoutineStatusJobData {
  routineId: string;
  endAt: string;
}

interface RoutineStatusCache {
  remainingMinutes: number;
  isDone: boolean;
}

@Injectable()
@Processor('routine-status')
export class RoutineStatusProcessor {
  private readonly logger = new Logger(RoutineStatusProcessor.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  @Process('updateRoutineStatus')
  async handleUpdate(job: Job<RoutineStatusJobData>) {
    const { routineId, endAt } = job.data;

    const now = new Date();
    const end = new Date(endAt);
    const diffMs = end.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

    const isDone = remainingMinutes <= 0;

    const cacheKey = `routine-status:${routineId}`;
    const status: RoutineStatusCache = { remainingMinutes, isDone };

    await this.cache.set(cacheKey, status);

    if (isDone) {
      this.logger.log(`Routine ${routineId} finished, stop scheduling`);
      return;
    }

    // > 2h => 60m
    // 1–2h => 30m
    // < 1h => 10m
    let nextIntervalMinutes: number;
    if (remainingMinutes > 120) {
      nextIntervalMinutes = 60;
    } else if (remainingMinutes > 60) {
      nextIntervalMinutes = 30;
    } else {
      nextIntervalMinutes = 10;
    }

    this.logger.log(
      `Routine ${routineId} remaining=${remainingMinutes}m, next in ${nextIntervalMinutes}m`,
    );

    await job.queue.add(
      'updateRoutineStatus',
      { routineId, endAt },
      {
        delay: nextIntervalMinutes * 60 * 1000,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
