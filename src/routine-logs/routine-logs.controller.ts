import { Controller, Post, Body, UseGuards, Req, Get, Param, Query } from '@nestjs/common';
import type { Request } from 'express';

import { PersonalRoutineLogsService } from './routine-logs.service';
import { CreatePersonalRoutineLogDto } from '../common/dto/routines/create-routine-logs.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { PersonalRoutineLog } from './routine-logs.entity';

@ApiBearerAuth('access-token')
@Controller('routine-logs')
@UseGuards(AuthGuard)
export class PersonalRoutineLogsController {
  constructor(
    private readonly logsService: PersonalRoutineLogsService,
  ) {}

  @Post()
  create(@Body() createLogDto: CreatePersonalRoutineLogDto, @Req() req: Request): Promise<PersonalRoutineLog> {
    const userId = req.user.id;
    return this.logsService.create(
      createLogDto.routineId,
      createLogDto.verificationImageUrl!,
      userId,
    );
  }

  @Get()
  @ApiOkResponse({ type: PersonalRoutineLog, isArray: true })
  async listAllLogs(@Req() req: Request): Promise<PersonalRoutineLog[]> {
    const userId = req.user.id;
    return this.logsService.listAllLogsForUser(userId);
  }

  @Get(':routineId')
  @ApiOkResponse({ type: PersonalRoutineLog, isArray: true })
  async listLogs(
    @Param('routineId') routineId: string,
    @Req() req: Request,
  ): Promise<PersonalRoutineLog[]> {
    const userId = req.user.id;
    return this.logsService.listLogs(routineId, userId);
  }

  @Get('calendar')
  @ApiOkResponse({
    description: 'Sadece tamamlanmış ve onaylanmış rutin günlerini döner',
  })
  @ApiQuery({ name: 'startDate', example: '2025-12-01', required: true })
  @ApiQuery({ name: 'endDate', example: '2025-12-31', required: true })
  @ApiQuery({ name: 'routineId', example: '1', required: true })
  async getCalendar(
    @Req() req: Request,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('routineId') routineId: string,
  ): Promise<{ date: string; isDone: boolean }[]> {
    const userId = req.user.id;
    return this.logsService.getCalendarLogs(userId, routineId, startDate, endDate);
  }
}
