import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { RoutineLog } from 'src/routine_logs/routine_logs.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(RoutineLog)
    private readonly logsRepo: Repository<RoutineLog>, // for streak operation
  ) {}

  // Finds a user by email using the database
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  // Creates a new user record in the database
  async createUser(dto: RegisterDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      name: dto.name,
      email: dto.email,
      gender: dto.gender,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      passwordHash,
      totalXp: 0,
      currentStreak: 0,
    });

    return this.usersRepo.save(user);
  }

  // Updates user's last login timestamp
  async updateLastLogin(user: User) {
    user.lastLoginAt = new Date();
    await this.usersRepo.save(user);
  }

  // Streak Update and Check Operation
  async checkAndUpdateStreak(userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) return;

    // 1. Fetch the last 2 logs for this user, ordered by date
    // if we check the logs after the user just finished a routine,
    // the "latest" log will always be Today. So, to determine if the streak continues,
    // we need to compare Today's Log vs. The Previous Log.
    const lastLogs = await this.logsRepo.find({
      where: { userId: userId },
      order: { logDate: 'DESC' },
      take: 2, // We only need the latest 2
    });

    // Case 0: No logs at all (Shouldn't happen if called after creation, but safe to handle)
    if (lastLogs.length === 0) {
      user.currentStreak = 0;
      await this.usersRepo.save(user);
      return;
    }

    // "Today's" Log (The one just created)
    const latestLogDate = new Date(lastLogs[0].logDate);
    const latestStr = latestLogDate.toISOString().split('T')[0];

    // Check against current date to be sure
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // If the latest log isn't even from today (e.g. backfilling), ignore logic or handle separately
    if (latestStr !== todayStr) {
      // This is an edge case, usually we assume this runs right after logging
      return;
    }

    // Case 1: First ever log
    if (lastLogs.length === 1) {
      user.currentStreak = 1;
      await this.usersRepo.save(user);
      return;
    }

    // Case 2: Compare with Previous Log
    const previousLogDate = new Date(lastLogs[1].logDate);
    const previousStr = previousLogDate.toISOString().split('T')[0];

    // Calculate difference in days
    const diffTime = Math.abs(latestLogDate.getTime() - previousLogDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (previousStr === todayStr) {
      // They already did a routine today earlier. Streak doesn't change.
      return;
    } else if (diffDays === 1) {
      // The previous log was Yesterday. Streak increments!
      user.currentStreak += 1;
    } else {
      // The previous log was 2+ days ago. Streak broken. Reset to 1 (for today).
      user.currentStreak = 1;
    }

    await this.usersRepo.save(user);
  }
}
