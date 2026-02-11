import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  ParseIntPipe,
  Param,
  Query,
} from '@nestjs/common';
import { RoutineLogsService } from './routine-logs.service';
import { CreateRoutineLogDto } from '../common/dto/routines/create-routine-logs.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { RoutineLog } from './routine-logs.entity';

import type { Request } from 'express';

@ApiBearerAuth('access-token')
@Controller('routine-logs')
@UseGuards(AuthGuard)
export class RoutineLogsController {
  constructor(private readonly logsService: RoutineLogsService) {}

  @Post()
  create(@Body() createLogDto: CreateRoutineLogDto, @Req() req: Request): Promise<RoutineLog> {
    const userId = (req.user as any).id;
    return this.logsService.create(
      createLogDto.routineId,
      createLogDto.verificationImageUrl!,
      userId,
    );
  }

  @Get('routine/:routineId')
  @ApiOkResponse({ type: RoutineLog, isArray: true })
  async getLogsByRoutine(
    @Param('routineId') routineId: string,
    @Req() req: Request,
  ): Promise<RoutineLog[]> {
    const userId = (req.user as any).id;
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
    const userId = (req.user as any).id;
    return this.logsService.getCalendarLogs(userId, routineId, startDate, endDate);
  }
}
