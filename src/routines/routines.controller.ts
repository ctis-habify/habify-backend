import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
}
