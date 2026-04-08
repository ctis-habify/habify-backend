import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CollaborativeScoreService } from './collaborative-score.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { LeaderboardEntryDto } from '../common/dto/collaborative-score/leaderboard-entry.dto';
import { ScoreSummaryDto } from '../common/dto/collaborative-score/score-summary.dto';

import type { Request } from 'express';

@ApiTags('collaborative-score')
@ApiBearerAuth('access-token')
@Controller('collaborative/score')
export class CollaborativeScoreController {
  constructor(private readonly collaborativeScoreService: CollaborativeScoreService) {}

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get collaborative score summary for the current user' })
  async getMyScore(@Req() req: Request): Promise<ScoreSummaryDto> {
    const userId = (req.user as JwtPayload).id;
    return this.collaborativeScoreService.getScoreSummary(userId);
  }

  @UseGuards(AuthGuard)
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get global leaderboard ranked by collaborative score' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max entries (default 50)',
  })
  async getLeaderboard(@Query('limit') limit?: string): Promise<LeaderboardEntryDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.collaborativeScoreService.getLeaderboard(parsedLimit);
  }

  @UseGuards(AuthGuard)
  @Get(':userId')
  @ApiOperation({ summary: 'Get collaborative score summary for a specific user' })
  async getUserScore(@Param('userId') userId: string): Promise<ScoreSummaryDto> {
    return this.collaborativeScoreService.getScoreSummary(userId);
  }
}
