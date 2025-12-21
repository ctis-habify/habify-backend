import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { VerificationService, VerificationJobData } from './verification.service';

@Processor('verification')
export class VerificationProcessor {
  constructor(private readonly verificationService: VerificationService) {}

  @Process('verify')
  async handleVerification(job: Job<VerificationJobData>) {
    await this.verificationService.process(job);
  }
}
