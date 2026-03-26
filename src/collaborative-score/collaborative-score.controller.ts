import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CollaborativeScoreService } from './collaborative-score.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

import type { Request } from 'express';

@ApiTags('collaborative-score')
@ApiBearerAuth('access-token')
@Controller('collaborative/score')
export class CollaborativeScoreController {
  constructor(private readonly collaborativeScoreService: CollaborativeScoreService) {}

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get collaborative score summary for the current user' })
  async getMyScore(@Req() req: Request): Promise<{ totalPoints: number; currentStreak: number }> {
    const userId = (req.user as JwtPayload).id;
    return this.collaborativeScoreService.getScoreSummary(userId);
  }
}
