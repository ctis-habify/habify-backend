import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RoutineListsService } from './routine_lists.service';
import { CreateRoutineListDto } from '../common/dto/routines/create-routine-list.dto';
import { UpdateRoutineListDto } from '../common/dto/routines/update-routine-list.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('routine_lists')
@ApiBearerAuth('access-token')
@Controller('routine_lists')
@UseGuards(AuthGuard)
export class RoutineListsController {
  constructor(private readonly routineListsService: RoutineListsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new routine list' })
  create(@Body() createDto: CreateRoutineListDto, @Req() req) {
    return this.routineListsService.create(createDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all routine lists for the current user' })
  findAll(@Req() req) {
    return this.routineListsService.findAll(req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update routine list name' })
  update(@Param('id') id: string, @Body() updateDto: UpdateRoutineListDto, @Req() req) {
    return this.routineListsService.update(+id, updateDto, req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a routine list by ID' })
  remove(@Param('id') id: string, @Req() req) {
    return this.routineListsService.remove(+id, req.user.sub);
  }
}
