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

@ApiTags('routines')
@ApiBearerAuth('access-token')
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @UseGuards(AuthGuard)
  @Get('me')
  async getMyRoutines(@Req() req) {
    const userId = req.user.id;
    return this.routinesService.getUserRoutines(userId);
  }

  // Create new routine
  @UseGuards(AuthGuard)
  @Post()
  async createRoutine(@Req() req, @Body() dto: CreateRoutineDto) {
    const userId = req.user.id;

    return this.routinesService.createRoutine({
      userId,
      ...dto,
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
    return this.routinesService.updateRoutine(req.user.id, id, dto);
  }

  // delete routine
  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteRoutine(@Req() req, @Param('id') id: string) {
    return this.routinesService.deleteRoutine(req.user.id, id);
  }

  // list grouped routines
  @UseGuards(AuthGuard)
  @Get('routines/grouped')
  async getMyRoutinesListed(@Req() req): Promise<RoutineListWithRoutinesDto[]> {
    const userId = req.user.id;
    return this.routinesService.getAllRoutinesByList(userId);
  }
}
