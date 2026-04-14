import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XpLog } from './xp-logs.entity';
import { CreateXpLogDto } from '../common/dto/xp-logs/create-xp-log.dto';
import { User } from '../users/users.entity';

@Injectable()
export class XpLogsService {
  constructor(
    @InjectRepository(XpLog)
    private readonly xpLogRepository: Repository<XpLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    createDto: CreateXpLogDto,
    userId: string,
  ): Promise<{ log: XpLog; updatedTotalXp: number }> {
    const { amount, eventType } = createDto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newLog = this.xpLogRepository.create({
      amount,
      eventType,
      user: user,
    });

    await this.xpLogRepository.save(newLog);

    user.totalXp = (user.totalXp || 0) + amount;
    await this.userRepository.save(user);

    return {
      log: newLog,
      updatedTotalXp: user.totalXp,
    };
  }

  async awardXP(
    userId: string,
    amount: number = 10,
    eventType: string = 'PERSONAL',
  ): Promise<XpLog | undefined> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return undefined;

    const newLog = this.xpLogRepository.create({
      amount: amount,
      eventType,
      user: user,
    });

    await this.xpLogRepository.save(newLog);

    user.totalXp = (user.totalXp || 0) + amount;
    await this.userRepository.save(user);

    return newLog;
  }

  async deductXP(userId: string, amount: number, eventType: string): Promise<XpLog | undefined> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return undefined;

    const deduction = Math.abs(amount);

    const newLog = this.xpLogRepository.create({
      amount: -deduction,
      eventType: eventType,
      user: user,
    });

    await this.xpLogRepository.save(newLog);

    user.totalXp = Math.max(0, (user.totalXp || 0) - deduction);
    await this.userRepository.save(user);

    return newLog;
  }

  async getTotalXp(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user ? user.totalXp || 0 : 0;
  }

  async findAll(userId: string): Promise<XpLog[]> {
    return await this.xpLogRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
    });
  }
}
