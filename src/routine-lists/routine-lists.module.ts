import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutineListsService } from './routine-lists.service';
import { RoutineListsController } from './routine-lists.controller';
import { RoutineList } from './routine-lists.entity';
import { Category } from '../categories/categories.entity';
import { AuthModule } from 'src/auth/auth.module';
import { Routine } from 'src/routines/routines.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([RoutineList, Category, Routine])],
  controllers: [RoutineListsController],
  providers: [RoutineListsService],
})
export class RoutineListsModule {}
