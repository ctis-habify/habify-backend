import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { Category } from './categories.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PersonalRoutineList } from 'src/routine-lists/routine-lists.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Category, PersonalRoutineList])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
