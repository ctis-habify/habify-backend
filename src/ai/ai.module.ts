import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
