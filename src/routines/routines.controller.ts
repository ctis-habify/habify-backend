import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { UsersService } from 'src/users/users.service';
import { TodayScreenResponseDto } from 'src/common/dto/routines/today-screen-response.dto';

@ApiTags('routines')
@ApiBearerAuth('access-token')
@Controller('routines')
export class RoutinesController {
  constructor(
    private readonly routinesService: RoutinesService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard)
  @Get('me')
  async getMyRoutines(@Req() req) {
    const userId = req.user.sub;
    return this.routinesService.getUserRoutines(userId);
  }

  // Create new routine
  @UseGuards(AuthGuard)
  @Post()
  async createRoutine(@Req() req, @Body() dto: CreateRoutineDto) {
    const userId = req.user?.sub;

    console.log('USER ID:', userId);
    console.log('ROUTINE LIST ID: ', dto.routineListId);
    return this.routinesService.createRoutine({
      ...dto,
      userId,
    });
  }

  // update routine
  @UseGuards(AuthGuard)
  @Patch(':id')
  async updateRoutine(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateRoutineDto,
  ) {
    return this.routinesService.updateRoutine(req.user.sub, id, dto);
  }

  // delete routine
  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteRoutine(@Req() req, @Param('id') id: string) {
    return this.routinesService.deleteRoutine(req.user.sub, id);
  }

  // list grouped routines
  @UseGuards(AuthGuard)
  @Get('grouped')
  async getMyRoutinesListed(@Req() req): Promise<RoutineListWithRoutinesDto[]> {
    const userId = req.user.sub;
    return this.routinesService.getAllRoutinesByList(userId);
  }

  @UseGuards(AuthGuard)
  @Get('today')
  //@ApiOperation({ summary: 'Get routines scheduled for today' })
  //@ApiOkResponse({ type: [RoutineResponseDto] })
  async getTodayRoutines(@Req() req): Promise<TodayScreenResponseDto> {
    const userId = req.user.sub; // Accessing user ID from the token
    // 1. Get Routines
    const routines = await this.routinesService.getTodayRoutines(userId);

    // 2. Get Streak (Just read the integer from DB)
    const user = await this.usersService.findByEmail(req.user.email); // You might need to expose a findOne or getStreak method
    const streak = user ? user.currentStreak : 0;

    return {
      streak: streak,
      routines: routines,
    };

    //return this.routinesService.getTodayRoutines(userId);
  }
}
