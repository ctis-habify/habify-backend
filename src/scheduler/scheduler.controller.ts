import { Controller, Post, Get, Sse, MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service.js';
import { Observable, map } from 'rxjs';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('daily-rollup')
  @ApiOperation({ summary: 'Trigger Daily Rollup Job Manually' })
  async triggerDailyRollup() {
    await this.schedulerService.handleDailyRollup();
    return { message: 'Daily rollup job triggered successfully' };
  }

  @Post('reminder-scan')
  @ApiOperation({ summary: 'Trigger Reminder Scan Job Manually' })
  async triggerReminderScan() {
    await this.schedulerService.handleReminderScan();
    return { message: 'Reminder scan job triggered successfully' };
  }

  @Sse('events')
  @ApiOperation({ summary: 'Stream of scheduler events (SSE)' })
  events(): Observable<MessageEvent> {
    return this.schedulerService
      .getEventsObservable()
      .pipe(map(data => ({ data }) as MessageEvent));
  }

  @Get('debug-routines')
  @ApiOperation({ summary: 'Debug: Get first 10 routines' })
  async getDebugRoutines() {
    return this.schedulerService.debugGetRoutines();
  }
}
