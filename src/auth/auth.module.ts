import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    forwardRef(() => UsersModule), // used to access user-related operations inside AuthService
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret_jwtkey_hbfy', // JWT signing key
      signOptions: { expiresIn: '30d' }, // token validity period
    }),
    AuditLogsModule,
  ],

  controllers: [AuthController], // handles /auth routes
  providers: [AuthService, JwtStrategy, AuthGuard], // main authentication logic
  exports: [AuthService, AuthGuard, JwtModule], // allows other modules to use AuthService if needed
})
export class AuthModule {}
