import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutinesController } from './routines.controller';
import { RoutinesService } from './routines.service';
import { Routine } from './routines.entity';
import { RoutineList } from './routine-list.entity';
import { Category } from './category.entity';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Routine, RoutineList, Category]),
    AuthModule, // AuthGuard ve JwtService için gerekli
    // JwtModule artık global, import etmeye gerek yok
  ],
  controllers: [RoutinesController],
  providers: [RoutinesService, AuthGuard], // AuthGuard'ı burada da provider olarak ekle
})
export class RoutinesModule {}
