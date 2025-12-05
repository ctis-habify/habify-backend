import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // For db
import { User } from './users.entity'; // For db
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => AuthModule), // Döngüsel bağımlılık varsa forwardRef kullan
    // JwtModule artık global, import etmeye gerek yok
  ],
  controllers: [UsersController],
  providers: [UsersService, AuthGuard], // AuthGuard'ı burada da provider olarak ekle
  exports: [UsersService],
})
export class UsersModule {}
