import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { RoutineLogsService } from './routine_logs.service';
import { CreateRoutineLogDto } from './dto/create-routine-logs.dto';
//import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('routine-logs')
//@UseGuards(JwtAuthGuard)
export class RoutineLogsController {
  constructor(private readonly logsService: RoutineLogsService) {}

  @Post()
  create(@Body() createLogDto: CreateRoutineLogDto, @Req() req) {
    return this.logsService.create(createLogDto, req.user.id);
  }
}
