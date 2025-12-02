import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutineLogsService } from './routine_logs.service';
import { RoutineLogsController } from './routine_logs.controller';
import { RoutineLog } from './routine_logs.entity';
import { Routine } from '../routines/routines.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoutineLog, Routine])],
  controllers: [RoutineLogsController],
  providers: [RoutineLogsService],
})
export class RoutineLogsModule {}
