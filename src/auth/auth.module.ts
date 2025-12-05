import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    forwardRef(() => UsersModule), // used to access user-related operations inside AuthService
    // JwtModule artık global, import etmeye gerek yok
  ],
  controllers: [AuthController], // handles /auth routes
  providers: [AuthService, AuthGuard], // main authentication logic
  exports: [AuthService, AuthGuard], // allows other modules to use AuthService and AuthGuard
})
export class AuthModule {}
