import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { RoutineLogsService } from './routine_logs.service';
import { CreateRoutineLogDto } from '../common/dto/routines/create-routine-logs.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { RoutineLog } from './routine_logs.entity';

@ApiBearerAuth('access-token')
@Controller('routine-logs')
@UseGuards(AuthGuard)
export class RoutineLogsController {
  constructor(private readonly logsService: RoutineLogsService) {}

  @Post()
  create(@Body() createLogDto: CreateRoutineLogDto, @Req() req) {
    return this.logsService.create(createLogDto, req.user.sub);
  }

  @Get('routine/:routineId')
  @ApiOkResponse({ type: RoutineLog, isArray: true })
  async getLogsByRoutine(
    @Param('routineId', ParseIntPipe) routineId: string,
    @Req() req,
  ): Promise<RoutineLog[]> {
    const userId = req.user.sub as string; // Coming from AuthGuard
    return this.logsService.listLogs(routineId, userId);
  }
}
