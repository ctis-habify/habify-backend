import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoutinesModule } from './routines/routines.module';
import { CategoriesModule } from './categories/categories.module';
import { RoutineLogsModule } from './routine_logs/routine_logs.module';
import { RoutineListsModule } from './routine_lists/routine_lists.module';
import { XpLogsModule } from './xp_logs/xp_logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
