import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoutinesModule } from './routines/routines.module';
import { dbConfig } from './config/db.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(dbConfig),
    JwtModule.register({
      global: true, // JwtModule'ü global yap - tüm modüller erişebilir
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    AuthModule,
    UsersModule,
    RoutinesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
