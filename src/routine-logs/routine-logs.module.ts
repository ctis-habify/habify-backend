import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutineLogsService } from './routine-logs.service';
import { RoutineLogsController } from './routine-logs.controller';
import { RoutineLog } from './routine-logs.entity';
import { Routine } from '../routines/routines.entity';
import { AuthModule } from 'src/auth/auth.module';
import { XpLogsModule } from '../xp-logs/xp-logs.module';
import { StorageModule } from 'src/storage/storage.module';
import { AiModule } from 'src/ai/ai.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([RoutineLog, Routine]),
    XpLogsModule,
    StorageModule,
    AiModule,
    UsersModule,
  ],
  controllers: [RoutineLogsController],
  providers: [RoutineLogsService],
  exports: [RoutineLogsService],
})
export class RoutineLogsModule {}
