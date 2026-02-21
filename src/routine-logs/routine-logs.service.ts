import { Between } from 'typeorm';
import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineLog } from './routine-logs.entity';
import { Routine } from '../routines/routines.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { GcsService } from 'src/storage/gcs.service';
import { AiService } from 'src/ai/ai.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class RoutineLogsService {
  private readonly logger = new Logger(RoutineLogsService.name);

  constructor(
    @InjectRepository(RoutineLog)
    private readonly logsRepository: Repository<RoutineLog>,
    @InjectRepository(Routine)
    private readonly routinesRepository: Repository<Routine>,
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
  ): Promise<RoutineLog> {
    const routine = await this.routinesRepository.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }
    if (!verificationImageUrl) {
      throw new BadRequestException('Verification image is required');
    }

    let isVerified = !!options?.preverified;

    if (!isVerified) {
      const signedReadUrl = await this.gcsService.getSignedReadUrl(verificationImageUrl, 600);

      const prompt = routine.routineName ?? 'a photo of the required routine activity';

      //AI VERIFICATION
      const aiResult = await this.aiService.verify({
        imageUrl: signedReadUrl,
        text: prompt,
      });

      if (!aiResult.verified) {
        this.logger.warn(`Routine verification failed for user: ${userId}`);
        throw new BadRequestException('Routine verification failed');
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

      if (routine.lastCompletedDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (routine.lastCompletedDate === yesterdayStr) {

          routine.streak += 1;
        } else {

          routine.streak = 1;
        }
      }


      routine.isAiVerified = true;
      routine.lastCompletedDate = today;
      await this.routinesRepository.save(routine);

      // 3. Award XP


      await this.xpLogsService.awardXP(userId, 10);


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
  ): Promise<{ date: string; isDone: boolean }[]> {
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

    return logs.map((log) => {
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
