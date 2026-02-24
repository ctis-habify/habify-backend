import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoutinesModule } from './routines/routines.module';
import { CategoriesModule } from './categories/categories.module';
import { RoutineLogsModule } from './routine-logs/routine-logs.module';
import { RoutineListsModule } from './routine-lists/routine-lists.module';
import { XpLogsModule } from './xp-logs/xp-logs.module';
import { StorageModule } from './storage/storage.module';
import { VerificationModule } from './verification/verification.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { FriendRequestsModule } from './friend-requests/friend-requests.module';
import { RoutineInvitationsModule } from './routine-invitations/routine-invitations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      autoLoadEntities: true,
      synchronize: true,
    }),

    AuthModule,
    UsersModule,
    RoutinesModule,
    CategoriesModule,
    RoutineLogsModule,
    RoutineListsModule,
    XpLogsModule,
    StorageModule,
    VerificationModule,
    SchedulerModule,
    FriendRequestsModule,
    RoutineInvitationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
