import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutineLogsService } from './routine_logs.service';
import { RoutineLogsController } from './routine_logs.controller';
import { RoutineLog } from './routine_logs.entity';
import { Routine } from '../routines/routines.entity';
import { AuthModule } from 'src/auth/auth.module';
import { XpLogsModule } from '../xp_logs/xp_logs.module';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([RoutineLog, Routine]), XpLogsModule],
  controllers: [RoutineLogsController],
  providers: [RoutineLogsService],
})
export class RoutineLogsModule {}
