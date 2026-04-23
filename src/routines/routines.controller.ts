import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  NotFoundException,
  Logger,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';
import { CreateCollaborativeRoutineDto } from '../common/dto/routines/create-collaborative-routine.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateRoutineDto } from 'src/common/dto/routines/update-routine.dto';
import { RoutineListWithRoutinesDto } from 'src/common/dto/routines/routine-list-with-routines.dto';
import { GroupDetailResponseDto } from 'src/common/dto/routines/group-detail-response.dto';
import { PublicCollaborativeRoutineResponseDto } from 'src/common/dto/routines/public-collaborative-routine-response.dto';
import { AiService } from 'src/ai/ai.service';
import { GcsService } from 'src/storage/gcs.service';
import { XpLogsService } from 'src/xp-logs/xp-logs.service';
import { RoutineLogsService } from 'src/routine-logs/routine-logs.service';
import { CollaborativeRoutineLogsService } from './collaborative-routine-logs.service';
import { UsersService } from 'src/users/users.service';
import { TodayScreenResponseDto } from 'src/common/dto/routines/today-screen-response.dto';
import { VerifyResult } from 'src/ai/ai.service';
import { CollaborativeRoutineViewDto } from '../common/dto/routines/collaborative-routine-view.dto';
import { RoutineLeaderboardEntryDto } from '../common/dto/collaborative-score/routine-leaderboard-entry.dto';
import { ApiOperation } from '@nestjs/swagger';

import type { Request } from 'express';
import { Routine } from './routines.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';

@ApiTags('routines')
@ApiBearerAuth('access-token')
@Controller('routines')
export class RoutinesController {
  private readonly logger = new Logger(RoutinesController.name);
  constructor(
    private readonly routinesService: RoutinesService,
    private readonly ai: AiService,
    private readonly gcs: GcsService,
    private readonly xp: XpLogsService,
    private readonly routineLogs: RoutineLogsService,
    private readonly collaborativeLogs: CollaborativeRoutineLogsService,
    private readonly usersService: UsersService,
  ) {}

  private getUserId(req: Request): string {
    const user = req.user as
      | import('../auth/interfaces/jwt-payload.interface').JwtPayload
      | undefined;
    if (!user?.id) {
      throw new BadRequestException('Authenticated user is required');
    }
    return user.id;
  }

  private getTodayStr(req: Request): string {
    const timezone = (req.headers['x-timezone'] as string) || 'UTC';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getMyRoutines(@Req() req: Request): Promise<Routine[]> {
    const userId = this.getUserId(req);
    return this.routinesService.getUserRoutines(userId);
  }

  // Create new routine
  @UseGuards(AuthGuard)
  @Post()
  async createRoutine(@Req() req: Request, @Body() dto: CreateRoutineDto): Promise<Routine> {
    const userId = this.getUserId(req);

    return this.routinesService.createRoutine({
      ...dto,
      userId,
    });
  }

  @UseGuards(AuthGuard)
  @Post('collaborative')
  async createCollaborativeRoutine(
    @Req() req: Request,
    @Body() dto: CreateCollaborativeRoutineDto,
  ): Promise<CollaborativeRoutine> {
    const userId = this.getUserId(req);
    return this.routinesService.createCollaborativeRoutine({
      ...dto,
      userId,
    });
  }

  @UseGuards(AuthGuard)
  @Post('join')
  async joinRoutine(
    @Req() req: Request,
    @Body() body: { key: string },
  ): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    return this.routinesService.joinRoutine(userId, body.key);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative/public')
  async browsePublicRoutines(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: number,
    @Query('frequencyType') frequencyType?: string,
    @Query('gender') gender?: string,
    @Query('age') age?: number,
    @Query('xp') xp?: number,
    @Query('memberId') memberId?: string,
  ): Promise<PublicCollaborativeRoutineResponseDto[]> {
    const userId = this.getUserId(req);
    return this.routinesService.browsePublicRoutines(
      userId,
      search,
      categoryId,
      frequencyType,
      gender,
      age,
      xp,
      memberId,
    );
  }

  @UseGuards(AuthGuard)
  @Post('collaborative/:id/join')
  async joinPublicRoutine(
    @Req() req: Request,
    @Param('id') routineId: string,
  ): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    return this.routinesService.joinPublicRoutine(userId, routineId);
  }

  @UseGuards(AuthGuard)
  @Delete('collaborative/:id/leave')
  async leaveRoutine(
    @Req() req: Request,
    @Param('id') routineId: string,
  ): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    return this.routinesService.removeMember(userId, routineId, userId);
  }

  @UseGuards(AuthGuard)
  @Post('collaborative/:id/creator-defeat')
  @ApiOperation({
    summary:
      'Called when a collaborative routine is defeated (lives = 0) and the caller is the creator. ' +
      'Deletes the routine if the creator is the sole member, or kicks the creator and ' +
      'promotes a random remaining member to creator.',
  })
  async handleCreatorDefeat(
    @Req() req: Request,
    @Param('id') routineId: string,
  ): Promise<{ message: string }> {
    this.getUserId(req); // ensures the caller is authenticated
    return this.routinesService.handleCreatorDefeat(routineId);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative')
  async getCollaborativeRoutines(@Req() req: Request): Promise<CollaborativeRoutine[]> {
    const userId = this.getUserId(req);
    return this.routinesService.getCollaborativeRoutines(userId);
  }

  @UseGuards(AuthGuard)
  @Get('group/:id')
  async getGroupDetail(@Param('id') id: string): Promise<GroupDetailResponseDto> {
    return this.routinesService.getGroupDetail(id);
  }

  @UseGuards(AuthGuard)
  @Delete('collaborative/:id/members/:userId')
  async removeMember(
    @Req() req: Request,
    @Param('id') routineId: string,
    @Param('userId') memberIdToRemove: string,
  ): Promise<{ message: string }> {
    const requesterId = this.getUserId(req);
    return this.routinesService.removeMember(requesterId, routineId, memberIdToRemove);
  }

  // list grouped routines
  @UseGuards(AuthGuard)
  @Get('grouped')
  async getMyRoutinesListed(@Req() req: Request): Promise<RoutineListWithRoutinesDto[]> {
    const userId = this.getUserId(req);
    const todayStr = this.getTodayStr(req);
    return this.routinesService.getAllRoutinesByList(userId, todayStr);
  }

  @UseGuards(AuthGuard)
  @Post('verify')
  async verify(
    @Body() body: { routineId?: string; objectPath?: string },
    @Req() req: Request,
  ): Promise<VerifyResult> {
    try {
      const userId = this.getUserId(req);
      const bodyRecord = body as Record<string, unknown>;
      const legacyRoutineId =
        typeof bodyRecord.routine_id === 'string' ? bodyRecord.routine_id : undefined;
      const routineId = (body.routineId || legacyRoutineId || '').trim();
      const objectPath = (body.objectPath || '').trim();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!routineId || !uuidRegex.test(routineId)) {
        throw new BadRequestException('Valid routineId is required');
      }
      if (!objectPath) {
        throw new BadRequestException('objectPath is required');
      }

      // 1. Try personal routine first
      let routine: Routine | CollaborativeRoutine | null =
        await this.routinesService.getRoutineById(userId, routineId);
      let isCollab = false;

      if (!routine) {
        // 2. Try collaborative routine
        routine = await this.routinesService.getCollaborativeRoutineById(routineId);
        isCollab = true;
      }

      if (!routine) throw new NotFoundException('Routine group or personal routine not found');

      if (isCollab) {
        await this.collaborativeLogs.create(routineId, objectPath, userId);
        return { score: 1, verified: false, pending: true };
      }

      const routineText = routine.routineName;
      const signedReadUrl = await this.gcs.getSignedReadUrl(objectPath, 600);
      const aiResult = await this.ai.verify({ imageUrl: signedReadUrl, text: routineText });

      if (aiResult.verified) {
        await this.routineLogs.create(routineId, objectPath, userId, {
          preverified: true,
        });
      }

      return aiResult;
    } catch (error) {
      this.logger.error(
        `verify failed: ${(error as Error)?.message || 'unknown error'} | body=${JSON.stringify(body)}`,
      );
      throw error;
    }
  }

  @UseGuards(AuthGuard)
  @Get('today')
  async getTodayRoutines(@Req() req: Request): Promise<TodayScreenResponseDto> {
    const userId = this.getUserId(req);
    const todayStr = this.getTodayStr(req);
    return this.routinesService.getTodayRoutines(userId, todayStr);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative/view')
  async viewCollaborativeRoutines(@Req() req: Request): Promise<CollaborativeRoutineViewDto[]> {
    const userId = (req.user as import('../auth/interfaces/jwt-payload.interface').JwtPayload).id;
    return this.routinesService.viewCollaborativeRoutines(userId);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative/pending-logs')
  async getPendingVerifications(@Req() req: Request) {
    const userId = (req.user as import('../auth/interfaces/jwt-payload.interface').JwtPayload).id;
    return this.collaborativeLogs.getPendingVerifications(userId);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative/:id/logs')
  async getCollaborativeLogs(@Param('id') id: string) {
    return this.collaborativeLogs.getLogsByRoutine(id);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative/:id/leaderboard')
  @ApiOperation({ summary: 'Get leaderboard for a specific collaborative routine' })
  async getCollaborativeRoutineLeaderboard(
    @Param('id') id: string,
  ): Promise<RoutineLeaderboardEntryDto[]> {
    return this.collaborativeLogs.getLeaderboard(id);
  }

  @UseGuards(AuthGuard)
  @Get(':id/calendar')
  @ApiOperation({ summary: 'Get calendar logs for a personal or collaborative routine' })
  async getAnyCalendarLogs(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request,
  ): Promise<{ date: string; isDone: boolean }[]> {
    const userId = this.getUserId(req);

    const collabRoutine = await this.routinesService.getCollaborativeRoutineById(id);
    if (collabRoutine) {
      return this.collaborativeLogs.getCalendarLogs(userId, id, startDate, endDate);
    }

    return this.routineLogs.getCalendarLogs(userId, id, startDate, endDate);
  }

  @UseGuards(AuthGuard)
  @Get(':id/logs')
  async getAnyRoutineLogs(@Param('id') id: string, @Req() req: Request) {
    const userId = this.getUserId(req);
    // Check if it's a collaborative routine
    const collabRoutine = await this.routinesService.getCollaborativeRoutineById(id);
    if (collabRoutine) {
      return this.collaborativeLogs.getLogsByRoutine(id);
    }
    // Otherwise try personal
    return this.routineLogs.listLogs(id, userId);
  }

  @UseGuards(AuthGuard)
  @Post('collaborative/logs/:logId/verify')
  async verifyCollaborativeLog(
    @Req() req: Request,
    @Param('logId') logId: number,
    @Body() body: { status: 'approved' | 'rejected' },
  ) {
    const userId = (req.user as import('../auth/interfaces/jwt-payload.interface').JwtPayload).id;
    return this.collaborativeLogs.verifyLog(userId, logId, body.status);
  }

  // Get routine by id
  @UseGuards(AuthGuard)
  @Get(':id')
  async getRoutineById(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<Routine | CollaborativeRoutine | null> {
    const userId = this.getUserId(req);
    const routine = await this.routinesService.getRoutineById(userId, id);
    if (routine) return routine;

    return this.routinesService.getCollaborativeRoutineById(id);
  }

  // update routine
  @UseGuards(AuthGuard)
  @Patch(':id')
  async updateRoutine(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRoutineDto,
  ): Promise<any> {
    const userId = this.getUserId(req);
    return this.routinesService.updateRoutine(userId, id, dto);
  }

  // delete routine
  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteRoutine(@Req() req: Request, @Param('id') id: string): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    return this.routinesService.deleteRoutine(userId, id);
  }
}
