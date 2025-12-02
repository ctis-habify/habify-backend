import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    UsersModule, // used to access user-related operations inside AuthService
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me', // JWT signing key
      signOptions: { expiresIn: '7d' }, // token validity period
    }),
  ],
  controllers: [AuthController], // handles /auth routes
  providers: [AuthService], // main authentication logic
  exports: [AuthService, JwtModule], // allows other modules to use AuthService if needed
})
export class AuthModule {}
