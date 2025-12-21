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

  async create(routineId: string, verificationImageUrl: string, userId: string) {
    const routine = await this.routinesRepository.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }
    if (!verificationImageUrl) {
      throw new BadRequestException('Verification image is required');
    }

    const signedReadUrl = await this.gcsService.getSignedReadUrl(
      verificationImageUrl,
      600,
    );

    const prompt = routine.routine_name ?? 'a photo of the required routine activity';

    // AI verification
    const aiResult = await this.aiService.verify({
      imageUrl: signedReadUrl,
      text: prompt,
    });

    if (!aiResult.verified) {
      throw new ForbiddenException('Routine verification failed');
    // 2. Update Streak (Now using the logic above)
    await this.usersService.checkAndUpdateStreak(userId);

    if (savedLog.isVerified) {
      await this.xpLogsService.awardXP(userId, 10);
    }

    const newLog = this.logsRepository.create({
      logDate: new Date(),
      isVerified: true,
      verificationImageUrl: verificationImageUrl, // GCS objectPath
      routine,
      userId,
    });

    const savedLog = await this.logsRepository.save(newLog);
    await this.xpLogsService.awardXP(userId, 10);
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
    if (!startDate || !endDate) return [];
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
