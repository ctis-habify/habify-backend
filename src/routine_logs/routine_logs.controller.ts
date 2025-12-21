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
import { RoutineLogsService } from './routine_logs.service';
import { CreateRoutineLogDto } from '../common/dto/routines/create-routine-logs.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { RoutineLog } from './routine_logs.entity';

@ApiBearerAuth('access-token')
@Controller('routine-logs')
@UseGuards(AuthGuard)
export class RoutineLogsController {
  constructor(private readonly logsService: RoutineLogsService) {}

  @Post()
  create(@Body() createLogDto: CreateRoutineLogDto, @Req() req) {
    return this.logsService.create(
      createLogDto.routineId,
      createLogDto.verificationImageUrl,
      req.user.sub,
    );
  }

  @Get('routine/:routineId')
  @ApiOkResponse({ type: RoutineLog, isArray: true })
  async getLogsByRoutine(
    @Param('routineId', ParseIntPipe) routineId: string,
    @Req() req,
  ): Promise<RoutineLog[]> {
    const userId = req.user.sub as string;
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
    @Req() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('routineId') routineId: string,
  ) {
    const userId = req.user.sub as string;
    return this.logsService.getCalendarLogs(userId, routineId, startDate, endDate);
  }
}
