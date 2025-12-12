import { Between } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineLog } from './routine_logs.entity';
import { CreateRoutineLogDto } from '../common/dto/routines/create-routine-logs.dto';
import { Routine } from '../routines/routines.entity';

@Injectable()
export class RoutineLogsService {
  constructor(
    @InjectRepository(RoutineLog)
    private logsRepository: Repository<RoutineLog>,
    @InjectRepository(Routine)
    private routinesRepository: Repository<Routine>,
  ) {}

  async create(createLogDto: CreateRoutineLogDto, userId: string) {
    const { routineId, logDate, isVerified, verificationImageUrl } = createLogDto;
    const routine = await this.routinesRepository.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    const newLog = this.logsRepository.create({
      logDate: new Date(logDate),
      isVerified: isVerified || false,
      verificationImageUrl: verificationImageUrl,
      routine: routine,
      userId: userId,
    });

    return await this.logsRepository.save(newLog);
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

  async getCalendarLogs(userId: string, startDate: string, endDate: string) {
    if (!startDate || !endDate) return [];

    return await this.logsRepository.find({
      where: {
        userId: userId,
        logDate: Between(new Date(startDate), new Date(endDate)),
      },
      relations: ['routine'],
      order: { logDate: 'ASC' },
    });
  }
}
