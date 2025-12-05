import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { XpLogsService } from './xp_logs.service';
import { CreateXpLogDto } from '../common/dto/xp_logs/create-xp-log.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('xp-logs')
@UseGuards(AuthGuard)
export class XpLogsController {
  constructor(private readonly xpLogsService: XpLogsService) {}

  @Post()
  create(@Body() createDto: CreateXpLogDto, @Req() req) {
    return this.xpLogsService.create(createDto, req.user.id);
  }

  @Get()
  findAll(@Req() req) {
    return this.xpLogsService.findAll(req.user.id);
  }
}
