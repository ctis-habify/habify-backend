import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from 'src/auth/auth.module';
import { RoutineLog } from 'src/routine_logs/routine_logs.entity';

@Module({
  imports: [forwardRef(() => AuthModule), TypeOrmModule.forFeature([User, RoutineLog])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
