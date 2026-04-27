import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { TranslationService } from './translation.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [AiService, TranslationService],
  exports: [AiService, TranslationService],
})
export class AiModule {}
