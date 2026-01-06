import { Between } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineLog } from './routine_logs.entity';
import { Routine } from '../routines/routines.entity';
import { XpLogsService } from '../xp_logs/xp_logs.service';
import { GcsService } from 'src/storage/gcs.service';
import { AiService } from 'src/ai/ai.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class RoutineLogsService {
  constructor(
    @InjectRepository(RoutineLog)
    private logsRepository: Repository<RoutineLog>,
    @InjectRepository(Routine)
    private routinesRepository: Repository<Routine>,
    private xpLogsService: XpLogsService,
    private gcsService: GcsService,
    private aiService: AiService,
    private usersService: UsersService,
  ) {}

  async create(
    routineId: string,
    verificationImageUrl: string,
    userId: string,
    options?: { preverified?: boolean },
  ) {
    const routine = await this.routinesRepository.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }
    if (!verificationImageUrl) {
      throw new BadRequestException('Verification image is required');
    }

    let isVerified = !!options?.preverified;

    if (!isVerified) {
      const signedReadUrl = await this.gcsService.getSignedReadUrl(
        verificationImageUrl,
        600,
      );

      const prompt = routine.routine_name ?? 'a photo of the required routine activity';

      //AI VERIFICATION
      const aiResult = await this.aiService.verify({
        imageUrl: signedReadUrl,
        text: prompt,
      });

      if (!aiResult.verified) {
        throw new ForbiddenException('Routine verification failed');
      }

      isVerified = aiResult.verified;
    }
    // 1. Create Routine Log
    const newLog = this.logsRepository.create({
      logDate: new Date(),
      isVerified: isVerified,
      verificationImageUrl: verificationImageUrl, // GCS objectPath
      routine,
      userId,
    });

    const savedLog = await this.logsRepository.save(newLog);

    if (savedLog.isVerified) {
      // 2. Update Routine status for immediate feedback
      const today = new Date().toISOString().split('T')[0];

      if (routine.last_completed_date !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (routine.last_completed_date === yesterdayStr) {
          console.log(
            `Incrementing streak for Routine ${routine.id}: ${routine.streak} -> ${routine.streak + 1}`,
          );
          routine.streak += 1;
        } else {
          console.log(`Starting/Resetting streak for Routine ${routine.id} to 1`);
          routine.streak = 1;
        }
      }

      console.log(
        `Updating Routine ${routine.id}: is_ai_verified ${routine.is_ai_verified} -> true`,
      );
      routine.is_ai_verified = true;
      routine.last_completed_date = today;
      await this.routinesRepository.save(routine);

      // 3. Award XP
      const userBefore = await this.usersService.findById(userId);
      console.log(`Awarding XP to User ${userId}: totalXp before ${userBefore?.totalXp}`);
      await this.xpLogsService.awardXP(userId, 10);
      const userAfter = await this.usersService.findById(userId);
      console.log(`Awarding XP to User ${userId}: totalXp after ${userAfter?.totalXp}`);
    }

    return savedLog;
  }

  async listLogs(routineId: string, userId: string): Promise<RoutineLog[]> {
    return await this.logsRepository.find({
      where: {
        userId,
        routine: { id: routineId },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getCalendarLogs(
    userId: string,
    routineId: string,
    startDate: string,
    endDate: string,
  ) {
    if (!startDate || !endDate) {
      return [];
    }

    const logs = await this.logsRepository.find({
      where: {
        userId: userId,
        routine: { id: String(routineId) },
        isVerified: true,
        logDate: Between(new Date(startDate), new Date(endDate)),
      },
      order: { logDate: 'ASC' },
    });

    return logs.map(log => {
      return {
        date:
          log.logDate instanceof Date
            ? log.logDate.toISOString().split('T')[0]
            : new Date(log.logDate).toISOString().split('T')[0],

        isDone: true,
      };
    });
  }
}
