import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Routine } from './routines.entity';
import { AuthModule } from 'src/auth/auth.module';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';
import { RoutineList } from '../routine_lists/routine_lists.entity';
import { User } from '../users/users.entity';
import { Category } from '../categories/categories.entity';
@Module({
  imports: [ AuthModule, TypeOrmModule.forFeature([Routine,RoutineList, User, Category])],
  controllers: [RoutinesController],
  providers: [RoutinesService],
  exports: [RoutinesService],
})
export class RoutinesModule {}
