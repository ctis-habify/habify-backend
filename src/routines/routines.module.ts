import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Routine } from './routines.entity';
import { RoutineList } from '../routine-lists/routine-lists.entity';
import { User } from '../users/users.entity';
import { Category } from '../categories/categories.entity';

import { AuthModule } from 'src/auth/auth.module';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';

import { RoutineLog } from 'src/routine-logs/routine-logs.entity';
import { AiService } from 'src/ai/ai.service';
import { AiModule } from 'src/ai/ai.module';
import { StorageModule } from 'src/storage/storage.module';
import { XpLogsModule } from 'src/xp-logs/xp-logs.module';
import { RoutineLogsModule } from 'src/routine-logs/routine-logs.module';
import { UsersModule } from 'src/users/users.module';

import { DueReminder } from './due-reminders.entity';

@Module({
  imports: [
    AuthModule,
    AiModule,
    StorageModule,
    XpLogsModule,
    RoutineLogsModule,
    UsersModule,
    // TypeORM repository'ler
    TypeOrmModule.forFeature([Routine, RoutineLog, RoutineList, User, Category, DueReminder]),
  ],
  controllers: [RoutinesController],
  providers: [RoutinesService, AiService],
  exports: [RoutinesService],
})
export class RoutinesModule {}
