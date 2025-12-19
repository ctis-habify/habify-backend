import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Routine } from './routines.entity';
import { RoutineList } from '../routine_lists/routine_lists.entity';
import { User } from '../users/users.entity';
import { Category } from '../categories/categories.entity';

import { AuthModule } from 'src/auth/auth.module';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';

import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import * as redisStore from 'cache-manager-redis-store';
import { RoutineStatusProcessor } from './routine-status.processor';
import { RoutineLog } from 'src/routine_logs/routine_logs.entity';

@Module({
  imports: [
    AuthModule,

    // TypeORM repository'ler
    TypeOrmModule.forFeature([Routine, RoutineLog, RoutineList, User, Category]),

    // Bull kuyruğu (routine durumlarını update eden worker için)
    BullModule.forRoot({
      redis: { host: 'localhost', port: 6379 },
    }),
    BullModule.registerQueue({
      name: 'routine-status',
    }),

    // Redis cache (CACHE_MANAGER injection için)
    CacheModule.register({
      // global yapmak istersen: isGlobal: true,
      store: redisStore,
      host: 'localhost',
      port: 6379,
      ttl: 0, // biz yönetiyoruz
    }),
  ],
  controllers: [RoutinesController],
  providers: [RoutinesService, RoutineStatusProcessor],
  exports: [RoutinesService],
})
export class RoutinesModule {}
