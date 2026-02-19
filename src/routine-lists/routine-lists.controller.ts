import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { RoutineListsService } from './routine-lists.service';
import { RoutineList } from './routine-lists.entity';
import { CreateRoutineListDto } from '../common/dto/routines/create-routine-list.dto';
import { UpdateRoutineListDto } from '../common/dto/routines/update-routine-list.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { Request } from 'express';


@ApiTags('routine-lists')
@ApiBearerAuth('access-token')
@Controller('routine-lists')
@UseGuards(AuthGuard)
export class RoutineListsController {
  constructor(private readonly routineListsService: RoutineListsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new routine list' })
  create(@Body() createDto: CreateRoutineListDto, @Req() req: Request): Promise<RoutineList> {
    const userId = req.user.id;
    return this.routineListsService.create(createDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all routine lists for the current user' })
  async getMyLists(@Req() req: Request): Promise<RoutineList[]> {
    const userId = req.user.id;
    return this.routineListsService.findAll(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update routine list name' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRoutineListDto,
    @Req() req: Request,
  ): Promise<RoutineList> {
    const userId = req.user.id;
    return this.routineListsService.update(+id, updateDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a routine list by ID' })
  remove(@Param('id') id: string, @Req() req: Request): Promise<{ message: string }> {
    const userId = req.user.id;
    return this.routineListsService.remove(+id, userId);
  }
}
