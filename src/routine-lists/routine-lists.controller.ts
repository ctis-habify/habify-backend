import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { PersonalRoutineListsService } from './routine-lists.service';
import { PersonalRoutineList } from './routine-lists.entity';
import { CreatePersonalRoutineListDto } from '../common/dto/routines/create-routine-list.dto';
import { UpdatePersonalRoutineListDto } from '../common/dto/routines/update-routine-list.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { Request } from 'express';

@ApiTags('routine-lists')
@ApiBearerAuth('access-token')
@Controller('routine-lists')
@UseGuards(AuthGuard)
export class PersonalRoutineListsController {
  constructor(private readonly routineListsService: PersonalRoutineListsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new routine list' })
  create(@Body() createDto: CreatePersonalRoutineListDto, @Req() req: Request): Promise<PersonalRoutineList> {
    const userId = req.user.id;
    return this.routineListsService.create(createDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all routine lists for the current user' })
  async getMyLists(@Req() req: Request): Promise<PersonalRoutineList[]> {
    const userId = req.user.id;
    return this.routineListsService.findAll(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update routine list name' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePersonalRoutineListDto,
    @Req() req: Request,
  ): Promise<PersonalRoutineList> {
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
