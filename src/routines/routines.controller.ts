import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  NotFoundException,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateRoutineDto } from 'src/common/dto/routines/update-routine.dto';
import { RoutineListWithRoutinesDto } from 'src/common/dto/routines/routine-list-with-routines.dto';
import { AiService } from 'src/ai/ai.service';
import { GcsService } from 'src/storage/gcs.service';
import { XpLogsService } from 'src/xp-logs/xp-logs.service';
import { RoutineLogsService } from 'src/routine-logs/routine-logs.service';
import { UsersService } from 'src/users/users.service';
import { TodayScreenResponseDto } from 'src/common/dto/routines/today-screen-response.dto';
import { VerifyResult } from 'src/ai/ai.service';

import type { Request } from 'express';
import { User } from 'src/users/users.entity';
import { Routine } from './routines.entity';
import { RoutineResponseDto } from 'src/common/dto/routines/routine-response.dto';

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
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('me')
  async getMyRoutines(@Req() req: Request): Promise<Routine[]> {
    const userId = (req.user as any).id;
    return this.routinesService.getUserRoutines(userId);
  }

  // Create new routine
  @UseGuards(AuthGuard)
  @Post()
  async createRoutine(@Req() req: Request, @Body() dto: CreateRoutineDto): Promise<Routine> {
    const userId = (req.user as any).id;

    console.log('USER ID:', userId);
    console.log('ROUTINE LIST ID: ', dto.routineListId);
    return this.routinesService.createRoutine({
      ...dto,
      userId,
    });
  }

  // list grouped routines
  @UseGuards(AuthGuard)
  @Get('grouped')
  async getMyRoutinesListed(@Req() req: Request): Promise<RoutineListWithRoutinesDto[]> {
    const userId = (req.user as any).id;
    return this.routinesService.getAllRoutinesByList(userId);
  }

  //Verify Photo
  @UseGuards(AuthGuard)
  @Post('verify')
  async verify(
    @Body() body: { routineId: string; objectPath: string },
    @Req() req: Request,
  ): Promise<VerifyResult> {
    const userId = (req.user as any).id;
    const routine = await this.routinesService.getRoutineById(userId, body.routineId);
    if (!routine) throw new NotFoundException('Routine not found');
    const routineText = routine.routineName;
    const signedReadUrl = await this.gcs.getSignedReadUrl(body.objectPath, 600);
    const aiResult = await this.ai.verify({ imageUrl: signedReadUrl, text: routineText });
    await this.routineLogs.create(body.routineId, body.objectPath, userId);
    return aiResult;
  }

  @UseGuards(AuthGuard)
  @Get('today')
  async getTodayRoutines(@Req() req: Request): Promise<TodayScreenResponseDto> {
    const userId = (req.user as any).id; // Accessing user ID from the token
    // 1. Get Routines
    const routines = await this.routinesService.getTodayRoutines(userId);

    return {
      routines: routines,
    };
  }

  // Get routine by id
  @UseGuards(AuthGuard)
  @Get(':id')
  async getRoutineById(@Req() req: Request, @Param('id') id: string): Promise<Routine | null> {
    const userId = (req.user as any).id;
    return this.routinesService.getRoutineById(userId, id);
  }

  // update routine
  @UseGuards(AuthGuard)
  @Patch(':id')
  async updateRoutine(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRoutineDto,
  ): Promise<Routine> {
    const userId = (req.user as any).id;
    return this.routinesService.updateRoutine(userId, id, dto);
  }

  // delete routine
  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteRoutine(@Req() req: Request, @Param('id') id: string): Promise<{ message: string }> {
    const userId = (req.user as any).id;
    return this.routinesService.deleteRoutine(userId, id);
  }
}
