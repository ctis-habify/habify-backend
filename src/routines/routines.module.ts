import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';
import { Routine } from './routines.entity';
import { RoutineList } from './routine-list.entity';
import { Category } from './category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Routine, RoutineList, Category])],
  controllers: [RoutinesController],
  providers: [RoutinesService],
})
export class RoutinesModule {}
