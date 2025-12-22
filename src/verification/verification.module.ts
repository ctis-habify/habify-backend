import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { Verification } from './verification.entity';
import { AiModule } from 'src/ai/ai.module';
import { StorageModule } from 'src/storage/storage.module';
import { RoutineLogsModule } from 'src/routine_logs/routine_logs.module';
import { Routine } from 'src/routines/routines.entity';
import { VerificationProcessor } from 'src/verification/verification.processor';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    AiModule,
    StorageModule,
    RoutineLogsModule,
    TypeOrmModule.forFeature([Verification, Routine]),
    BullModule.registerQueue({ name: 'verification' }),
  ],
  controllers: [VerificationController],
  providers: [VerificationService, VerificationProcessor],
  exports: [VerificationService],
})
export class VerificationModule {}
