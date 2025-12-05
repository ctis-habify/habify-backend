import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { RoutineListsService } from './routine_lists.service';
import { CreateRoutineListDto } from '../common/dto/routines/create-routine-list.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('access-token')
@Controller('routine_lists')
@UseGuards(AuthGuard)
export class RoutineListsController {
  constructor(private readonly routineListsService: RoutineListsService) {}

  @Post()
  create(@Body() createDto: CreateRoutineListDto, @Req() req) {
    return this.routineListsService.create(createDto, req.user.id);
  }

  @Get()
  findAll(@Req() req) {
    return this.routineListsService.findAll(req.user.id);
  }
}
