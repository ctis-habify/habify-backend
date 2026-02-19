import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CollaborativeRoutineLog } from './collaborative-routine-logs.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineMember } from './routine-members.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { GcsService } from 'src/storage/gcs.service';
import { AiService } from 'src/ai/ai.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class CollaborativeRoutineLogsService {
  constructor(
    @InjectRepository(CollaborativeRoutineLog)
    private readonly logsRepository: Repository<CollaborativeRoutineLog>,
    @InjectRepository(CollaborativeRoutine)
    private readonly routinesRepository: Repository<CollaborativeRoutine>,
    @InjectRepository(RoutineMember)
    private readonly memberRepository: Repository<RoutineMember>,
    private readonly xpLogsService: XpLogsService,
    private readonly gcsService: GcsService,
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    routineId: string,
    verificationImageUrl: string,
    userId: string,
    options?: { preverified?: boolean },
  ): Promise<CollaborativeRoutineLog> {
    const routine = await this.routinesRepository.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Collaborative routine not found');
    }

    // Check membership
    const membership = await this.memberRepository.findOne({
      where: { userId, collaborativeRoutineId: routineId },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this routine group');
    }

    if (!verificationImageUrl) {
      throw new BadRequestException('Verification image is required');
    }

    let isVerified = !!options?.preverified;

    if (!isVerified) {
      const signedReadUrl = await this.gcsService.getSignedReadUrl(verificationImageUrl, 600);
      const prompt = routine.routineName ?? 'a photo of the required routine activity';

      const aiResult = await this.aiService.verify({
        imageUrl: signedReadUrl,
        text: prompt,
      });

      if (!aiResult.verified) {
        throw new ForbiddenException('Routine verification failed');
      }

      isVerified = aiResult.verified;
    }

    const newLog = this.logsRepository.create({
      logDate: new Date(),
      isVerified: isVerified,
      verificationImageUrl: verificationImageUrl,
      routine,
      userId,
    });

    const savedLog = await this.logsRepository.save(newLog);

    if (savedLog.isVerified) {
      const today = new Date().toISOString().split('T')[0];

      if (membership.lastCompletedDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (membership.lastCompletedDate === yesterdayStr) {
          membership.streak += 1;
        } else {
          membership.streak = 1;
        }
        membership.lastCompletedDate = today;
        await this.memberRepository.save(membership);
      }

      await this.xpLogsService.awardXP(userId, routine.completionXp || 10);
    }

    return savedLog;
  }
}
