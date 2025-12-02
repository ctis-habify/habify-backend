import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // For db
import { User } from './users.entity'; // For db
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from 'src/auth/auth.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => AuthModule) // Döngüsel bağımlılık varsa forwardRef kullan, yoksa direkt AuthModule
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
