import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalRoutineListsService } from './routine-lists.service';
import { PersonalRoutineListsController } from './routine-lists.controller';
import { PersonalRoutineList } from './routine-lists.entity';
import { Category } from '../categories/categories.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PersonalRoutine } from 'src/routines/routines.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([PersonalRoutineList, Category, PersonalRoutine])],
  controllers: [PersonalRoutineListsController],
  providers: [PersonalRoutineListsService],
})
export class PersonalRoutineListsModule {}
