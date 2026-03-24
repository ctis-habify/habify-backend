import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  NotFoundException,
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

import type { Request } from 'express';
import { Routine } from './routines.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';

@ApiTags('routines')
@ApiBearerAuth('access-token')
@Controller('routines')
export class RoutinesController {
  constructor(
    private readonly routinesService: RoutinesService,
    private readonly ai: AiService,
    private readonly gcs: GcsService,
    private readonly xp: XpLogsService,
    private readonly routineLogs: RoutineLogsService,
    private readonly collaborativeLogs: CollaborativeRoutineLogsService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('me')
  async getMyRoutines(@Req() req: Request): Promise<Routine[]> {
    const userId = req.user.id;
    return this.routinesService.getUserRoutines(userId);
  }

  // Create new routine
  @UseGuards(AuthGuard)
  @Post()
  async createRoutine(@Req() req: Request, @Body() dto: CreateRoutineDto): Promise<Routine> {
    const userId = req.user.id;

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
    const userId = req.user.id;
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
    const userId = req.user.id;
    return this.routinesService.joinRoutine(userId, body.key);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative/public')
  async browsePublicRoutines(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: number,
    @Query('frequencyType') frequencyType?: string,
  ): Promise<PublicCollaborativeRoutineResponseDto[]> {
    const userId = req.user.id;
    return this.routinesService.browsePublicRoutines(userId, search, categoryId, frequencyType);
  }

  @UseGuards(AuthGuard)
  @Post('collaborative/:id/join')
  async joinPublicRoutine(
    @Req() req: Request,
    @Param('id') routineId: string,
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    return this.routinesService.joinPublicRoutine(userId, routineId);
  }

  @UseGuards(AuthGuard)
  @Delete('collaborative/:id/leave')
  async leaveRoutine(
    @Req() req: Request,
    @Param('id') routineId: string,
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    return this.routinesService.removeMember(userId, routineId, userId);
  }

  @UseGuards(AuthGuard)
  @Get('collaborative')
  async getCollaborativeRoutines(@Req() req: Request): Promise<CollaborativeRoutine[]> {
    const userId = req.user.id;
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
    const requesterId = req.user.id;
    return this.routinesService.removeMember(requesterId, routineId, memberIdToRemove);
  }

  // list grouped routines
  @UseGuards(AuthGuard)
  @Get('grouped')
  async getMyRoutinesListed(@Req() req: Request): Promise<RoutineListWithRoutinesDto[]> {
    const userId = req.user.id;
    return this.routinesService.getAllRoutinesByList(userId);
  }

  @UseGuards(AuthGuard)
  @Post('verify')
  async verify(
    @Body() body: { routineId: string; objectPath: string },
    @Req() req: Request,
  ): Promise<VerifyResult> {
    const userId = req.user.id;

    // 1. Try personal routine first
    let routine: Routine | CollaborativeRoutine | null = await this.routinesService.getRoutineById(
      userId,
      body.routineId,
    );
    let isCollab = false;

    if (!routine) {
      // 2. Try collaborative routine
      routine = await this.routinesService.getCollaborativeRoutineById(body.routineId);
      isCollab = true;
    }

    if (!routine) throw new NotFoundException('Routine group or personal routine not found');

    if (isCollab) {
      await this.collaborativeLogs.create(body.routineId, body.objectPath, userId);
      return { score: 1, verified: false, pending: true };
    }

    const routineText = routine.routineName;
    const signedReadUrl = await this.gcs.getSignedReadUrl(body.objectPath, 600);
    const aiResult = await this.ai.verify({ imageUrl: signedReadUrl, text: routineText });

    if (aiResult.verified) {
      await this.routineLogs.create(body.routineId, body.objectPath, userId, {
        preverified: true,
      });
    }

    return aiResult;
  }

  @UseGuards(AuthGuard)
  @Get('today')
  async getTodayRoutines(@Req() req: Request): Promise<TodayScreenResponseDto> {
    const userId = req.user.id; // Accessing user ID from the token
    // 1. Get Routines
    const routines = await this.routinesService.getTodayRoutines(userId);

    return {
      routines: routines,
    };
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
  @Get(':id/logs')
  async getAnyRoutineLogs(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user.id;
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
    const userId = req.user.id;
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
  ): Promise<Routine> {
    const userId = req.user.id;
    return this.routinesService.updateRoutine(userId, id, dto);
  }

  // delete routine
  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteRoutine(@Req() req: Request, @Param('id') id: string): Promise<{ message: string }> {
    const userId = req.user.id;
    return this.routinesService.deleteRoutine(userId, id);
  }
}
