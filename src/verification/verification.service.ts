import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { Repository } from 'typeorm';
import { Verification } from './verification.entity';
import { SubmitVerificationDto } from '../common/dto/verification/submit-verification.dto';
import { Routine } from 'src/routines/routines.entity';
import { AiService } from 'src/ai/ai.service';
import { GcsService } from 'src/storage/gcs.service';
import { RoutineLogsService } from 'src/routine_logs/routine_logs.service';

export type VerificationJobData = {
  verificationId: string;
};

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(Routine)
    private readonly routineRepository: Repository<Routine>,
    private readonly aiService: AiService,
    private readonly gcsService: GcsService,
    private readonly routineLogsService: RoutineLogsService,
    @InjectQueue('verification')
    private readonly verificationQueue: Queue<VerificationJobData>,
  ) {}

  async submit(dto: SubmitVerificationDto, userId: string) {
    const routine = await this.routineRepository.findOne({
      where: { id: dto.routineId },
    });
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    if (!dto.gcsObjectPath?.trim()) {
      throw new BadRequestException('Verification image URL is required');
    }

    const verification = this.verificationRepository.create({
      routine,
      userId,
      verificationImageUrl: dto.gcsObjectPath,
      status: 'pending',
    });

    const saved = await this.verificationRepository.save(verification);

    await this.verificationQueue.add(
      'verify',
      { verificationId: saved.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return saved;
  }

  async process(job: Job<VerificationJobData>) {
    const verification = await this.verificationRepository.findOne({
      where: { id: job.data.verificationId },
      relations: ['routine'],
    });

    if (!verification) {
      this.logger.warn(`Verification ${job.data.verificationId} not found`);
      return;
    }

    if (!verification.routine) {
      throw new NotFoundException('Routine not found for verification');
    }

    await this.updateStatus(verification.id, 'processing');

    try {
      const signedUrl = await this.gcsService.getSignedReadUrl(
        verification.verificationImageUrl,
        600,
      );
      const prompt = verification.routine?.routine_name ?? 'Routine verification photo';
      const aiResult = await this.aiService.verify({ imageUrl: signedUrl, text: prompt });

      verification.score = aiResult.score;
      verification.isVerified = aiResult.verified;
      verification.failReason = aiResult.verified ? null : 'AI verification failed';
      verification.status = aiResult.verified ? 'succeeded' : 'failed';
      await this.verificationRepository.save(verification);

      if (aiResult.verified) {
        await this.routineLogsService.create(
          verification.routine.id,
          verification.verificationImageUrl,
          verification.userId,
          {
            preverified: true,
          },
        );
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown verification error';
      verification.failReason = reason;
      verification.status =
        job.attemptsMade + 1 >= (job.opts.attempts ?? 1) ? 'failed' : 'pending';
      await this.verificationRepository.save(verification);
      this.logger.error(`Verification ${verification.id} failed: ${reason}`);
      throw err;
    }
  }

  async findOne(id: string) {
    const verification = await this.verificationRepository.findOne({ where: { id } });
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }
    return verification;
  }

  private async updateStatus(id: string, status: Verification['status']) {
    await this.verificationRepository.update({ id }, { status });
  }
}
