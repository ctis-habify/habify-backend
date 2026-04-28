import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { Verification } from './verification.entity';
import { AiModule } from 'src/ai/ai.module';
import { StorageModule } from 'src/storage/storage.module';
import { PersonalRoutineLogsModule } from 'src/routine-logs/routine-logs.module';
import { PersonalRoutine } from 'src/routines/routines.entity';
import { VerificationProcessor } from 'src/verification/verification.processor';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    AiModule,
    StorageModule,
    PersonalRoutineLogsModule,
    TypeOrmModule.forFeature([Verification, PersonalRoutine]),
    BullModule.registerQueue({ name: 'verification' }),
  ],
  controllers: [VerificationController],
  providers: [VerificationService, VerificationProcessor],
  exports: [VerificationService],
})
export class VerificationModule {}
