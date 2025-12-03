import { Module } from '@nestjs/common';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Routine } from './routines.entity';
import { AuthModule } from 'src/auth/auth.module';
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Routine])],
  controllers: [RoutinesController],
  providers: [RoutinesService],
})
export class RoutinesModule {}
