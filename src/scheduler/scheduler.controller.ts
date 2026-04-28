import { Controller, Post, Get, Sse, MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { Observable, map } from 'rxjs';
import { PersonalRoutine } from '../routines/routines.entity';

@ApiTags('scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('daily-rollup')
  @ApiOperation({ summary: 'Trigger Daily Rollup Job Manually' })
  async triggerDailyRollup(): Promise<{ message: string }> {
    await this.schedulerService.handleDailyRollup();
    return { message: 'Daily rollup job triggered successfully' };
  }

  @Sse('events')
  @ApiOperation({ summary: 'Stream of scheduler events (SSE)' })
  events(): Observable<MessageEvent> {
    return this.schedulerService
      .getEventsObservable()
      .pipe(map((data) => ({ data }) as MessageEvent));
  }
}
