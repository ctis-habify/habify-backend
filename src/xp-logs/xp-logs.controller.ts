import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { XpLogsService } from './xp-logs.service';
import { XpLog } from './xp-logs.entity';
import { CreateXpLogDto } from '../common/dto/xp-logs/create-xp-log.dto';
import { AuthGuard } from 'src/auth/auth.guard';

import type { Request } from 'express';

@Controller('xp-logs')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
export class XpLogsController {
  constructor(private readonly xpLogsService: XpLogsService) {}

  @Post()
  create(
    @Body() createDto: CreateXpLogDto,
    @Req() req: Request,
  ): Promise<{ log: XpLog; updatedTotalXp: number }> {
    const userId = (req.user as any).id;
    return this.xpLogsService.create(createDto, userId);
  }

  @Get()
  findAll(@Req() req: Request): Promise<XpLog[]> {
    const userId = (req.user as any).id;
    return this.xpLogsService.findAll(userId);
  }

  @Get('total')
  @ApiOperation({ summary: 'Kullanıcının toplam puanını getirir' })
  async getTotalXp(@Req() req: Request): Promise<{ totalXp: number }> {
    const userId = (req.user as any).id;
    const total = await this.xpLogsService.getTotalXp(userId);
    return { totalXp: total };
  }
}
