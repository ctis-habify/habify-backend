import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, type Repository } from 'typeorm';
import { Routine } from './routines.entity';
import type { CreateRoutineDto } from '../common/dto/routines/create-routines.dto';
import { UpdateRoutineDto } from 'src/common/dto/routines/update-routine.dto';
import { RoutineListItemDto } from 'src/common/dto/routines/routine-list-item.dto';

import { Category } from 'src/categories/categories.entity';
import { RoutineList } from 'src/routine-lists/routine-lists.entity';
import { RoutineListWithRoutinesDto } from 'src/common/dto/routines/routine-list-with-routines.dto';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { RoutineResponseDto } from 'src/common/dto/routines/routine-response.dto';
import { GroupDetailResponseDto } from 'src/common/dto/routines/group-detail-response.dto';
import { randomBytes } from 'crypto';
import { CreateCollaborativeRoutineDto } from 'src/common/dto/routines/create-collaborative-routine.dto';
import { RoutineMember } from './routine-members.entity';
import { UsersService } from 'src/users/users.service';
import { Gender } from 'src/users/users.entity';

@Injectable()
export class RoutinesService {
  private readonly logger = new Logger(RoutinesService.name);

  constructor(
    @InjectRepository(RoutineList)
    private readonly routineListRepo: Repository<RoutineList>,

    @InjectRepository(RoutineLog)
    private readonly logRepo: Repository<RoutineLog>,

    @InjectRepository(Routine)
    private routineRepo: Repository<Routine>,
    @InjectRepository(CollaborativeRoutine)
    private collaborativeRoutineRepo: Repository<CollaborativeRoutine>,
    @InjectRepository(RoutineMember)
    private memberRepo: Repository<RoutineMember>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    private readonly usersService: UsersService,
  ) {}

  // List routines by user
  async getUserRoutines(userId: string): Promise<Routine[]> {
    return this.routineRepo.find({
      where: { userId: userId },
      order: { startTime: 'ASC' },
    });
  }

  //Get routine by id
  async getRoutineById(userId: string, routineId: string): Promise<Routine | null> {
    return this.routineRepo.findOne({
      where: { userId: userId, id: routineId },
    });
  }

  async getCollaborativeRoutineById(routineId: string): Promise<CollaborativeRoutine | null> {
    return this.collaborativeRoutineRepo.findOne({
      where: { id: routineId },
      relations: ['category'],
    });
  }

  // create new routine
  async createRoutine(data: CreateRoutineDto & { userId: string }): Promise<Routine> {
    const routine = this.routineRepo.create({
      userId: data.userId,
      routineListId: data.routineListId,
      routineName: data.routineName,
      frequencyType: data.frequencyType,
      startTime: data.startTime ?? '00:00:00',
      endTime: data.endTime ?? '23:59:59',
      startDate: data.startDate,
      isAiVerified: false,
    });

    const saved = await this.routineRepo.save(routine);


    // Worker için ilk job

    return saved;
  }

  // Create collaborative routine
  async createCollaborativeRoutine(
    data: CreateCollaborativeRoutineDto & { userId: string },
  ): Promise<CollaborativeRoutine> {
    const collaborativeKey = randomBytes(4).toString('hex').toUpperCase();

    const routine = this.collaborativeRoutineRepo.create({
      routineName: data.routineName,
      frequencyType: data.frequencyType,
      startTime: data.startTime ?? '00:00:00',
      endTime: data.endTime ?? '23:59:59',
      startDate: data.startDate,
      collaborativeKey: collaborativeKey,
      creatorId: data.userId,
      categoryId: data.categoryId,
      description: data.description,
      lives: data.lives,
      isPublic: data.isPublic,
      rewardCondition: data.rewardCondition,
      ageRequirement: data.ageRequirement,
      genderRequirement: data.genderRequirement,
      xpRequirement: data.xpRequirement,
      completionXp: data.completionXp,
    });

    const saved = await this.collaborativeRoutineRepo.save(routine);

    // Initial membership for the creator
    const creatorMember = this.memberRepo.create({
      collaborativeRoutineId: saved.id,
      userId: data.userId,
      role: 'creator',
      streak: 0,
      missedCount: 0,
    });
    await this.memberRepo.save(creatorMember);



    return saved;
  }

  async joinRoutine(userId: string, key: string): Promise<{ message: string }> {
    const routine = await this.collaborativeRoutineRepo.findOne({
      where: { collaborativeKey: key.toUpperCase() },
    });

    if (!routine) {
      throw new NotFoundException('Collaborative routine not found with this key');
    }

    // Check if already a member
    const existing = await this.memberRepo.findOne({
      where: { userId, collaborativeRoutineId: routine.id },
    });

    if (existing) {
      return { message: 'You are already a member of this routine group' };
    }

    // Check requirements
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Age requirement check
    if (routine.ageRequirement) {
      if (!user.birthDate) {
        throw new BadRequestException(
          'This routine requires you to have a birth date set in your profile',
        );
      }
      const age = this.calculateAge(new Date(user.birthDate));
      if (age < routine.ageRequirement) {
        throw new BadRequestException(
          `You must be at least ${routine.ageRequirement} years old to join this routine`,
        );
      }
    }

    // Gender requirement check
    if (routine.genderRequirement && routine.genderRequirement !== Gender.na) {
      if (user.gender !== routine.genderRequirement) {
        throw new BadRequestException(
          `This routine is only for ${routine.genderRequirement} members`,
        );
      }
    }

    // XP requirement check
    if (routine.xpRequirement && routine.xpRequirement > 0) {
      if (user.totalXp < routine.xpRequirement) {
        throw new BadRequestException(
          `You need at least ${routine.xpRequirement} XP to join this routine`,
        );
      }
    }

    const membership = this.memberRepo.create({
      collaborativeRoutineId: routine.id,
      userId,
      role: 'member',
      streak: 0,
      missedCount: 0,
    });

    await this.memberRepo.save(membership);
    return { message: 'Joined collaborative routine successfully' };
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async getCollaborativeRoutines(userId: string): Promise<CollaborativeRoutine[]> {
    // Returns routines where user is a member
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['routine', 'routine.category'],
    });
    return memberships.map((m) => m.routine);
  }

  async getGroupDetail(routineId: string): Promise<GroupDetailResponseDto> {
    const routine = await this.collaborativeRoutineRepo.findOne({
      where: { id: routineId },
      relations: ['category', 'members', 'members.user'],
    });

    if (!routine) {
      throw new NotFoundException('Group not found');
    }

    return {
      id: routine.id,
      name: routine.routineName,
      description: routine.description,
      category: routine.category?.name,
      rules: {
        lives: routine.lives,
        reward: routine.rewardCondition,
        frequency: routine.frequencyType,
        time: `${routine.startTime} - ${routine.endTime}`,
      },
      inviteKey: routine.collaborativeKey,
      memberCount: routine.members.length,
      participants: routine.members.map((m) => ({
        username: m.user.name,
        role: m.role,
        streak: m.streak,
        joinedAt: m.joinedAt,
      })),
    };
  }

  // update routine
  async updateRoutine(userId: string, routineId: string, dto: UpdateRoutineDto): Promise<Routine> {
    const routine = await this.routineRepo.findOne({
      where: { id: routineId, userId: userId },
    });
    if (!routine) {
      throw new NotFoundException('Routine not found or access denied');
    }

    const oldFreq = routine.frequencyType?.toLowerCase();
    const newFreq = dto.frequencyType?.toLowerCase();

    // Mapping manual fields
    if (dto.routineName) routine.routineName = dto.routineName;
    if (dto.frequencyType) routine.frequencyType = dto.frequencyType;
    if (dto.startDate) routine.startDate = dto.startDate;
    if (oldFreq === 'daily' && newFreq === 'weekly') {
      routine.startTime = '00:00:00';
      routine.endTime = '23:59:59';
    } else {
      if (dto.startTime) routine.startTime = dto.startTime;
      if (dto.endTime) routine.endTime = dto.endTime;
    }

    const updated = await this.routineRepo.save(routine);
    return updated;
  }

  async deleteRoutine(userId: string, routineId: string): Promise<{ message: string }> {
    const found = await this.routineRepo.findOne({
      where: {
        userId: userId,
        id: routineId,
      },
    });
    if (!found) {
      return { message: 'ROUTINE IS NOT FOUND!' };
    }
    await this.routineRepo.delete(routineId);
    return { message: 'ROUTINE IS DELETED SUCCESSFULLY' };
  }

  async getAllRoutinesByList(userId: string): Promise<RoutineListWithRoutinesDto[]> {
    const lists = await this.routineListRepo.find({
      where: { userId: userId },
      relations: ['category', 'routines'],
      order: { id: 'ASC' },
    });

    const result: RoutineListWithRoutinesDto[] = [];

    for (const list of lists) {
      const routinesSorted = [...(list.routines ?? [])].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );

      const routineDtos: RoutineListItemDto[] = [];

      for (const routine of routinesSorted) {
        // Recalculate remaining minutes based on frequency logic
        const now = new Date();
        let endAt = new Date();
        const [h, m, s] = routine.endTime.split(':').map(Number);

        let isWeeklyPending = false;

        const frequencyLower = routine.frequencyType.toLowerCase();

        if (frequencyLower === 'weekly') {
          // Weekly: Reset every 7 days from start_date
          // Parse start_date (YYYY-MM-DD)
          const [sy, sm, sd] = routine.startDate.split('-').map(Number);
          const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);

          // Calculate days passed since start
          const diffTime = now.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          // Current cycle index (0 for first week, 1 for second...)
          // If diffDays is negative (future start), cycle is 0
          const currentCycleIndex = diffDays >= 0 ? Math.floor(diffDays / 7) : 0;

          // Calculate which day of the cycle we are in (0-6)
          const currentCycleDay = diffDays >= 0 ? diffDays % 7 : 0;

          // If we are NOT in the 7th day (index 6), it is pending
          if (currentCycleDay < 6) {
            isWeeklyPending = true;
          }

          // Target day is the 7th day of the current cycle (Start + index*7 + 6 days)
          // Weekly deadline is always 23:59:59 on the 7th day
          const daysToAdd = currentCycleIndex * 7 + 6;

          endAt = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          endAt.setHours(23, 59, 59, 999);
        } else {
          // Daily (or others treated as daily): Reset every day after 00:00
          // Target is Today at end_time
          endAt = new Date(); // Today
          endAt.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
        }

        const diffMs = endAt.getTime() - now.getTime();
        const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

        let remainingLabel = '';

        if (frequencyLower === 'weekly' && isWeeklyPending && remainingMinutes > 0) {
          remainingLabel = 'Pending';
        } else {
          if (remainingMinutes > 1440) {
            // More than 24 hours (Daily case or fail-safe)
            const remainingDays = Math.ceil(remainingMinutes / 1440);
            remainingLabel = `${remainingDays} Days`;
          } else {
            remainingLabel = this.formatRemainingLabel(remainingMinutes);
          }
        }
        const isDone = routine.isAiVerified;

        if (remainingMinutes <= 0 && !isDone) {
          remainingLabel = 'Failed';
        }

        routineDtos.push({
          id: routine.id,
          routineName: routine.routineName,
          frequencyType: routine.frequencyType,
          startTime: routine.startTime,
          endTime: routine.endTime,
          startDate: routine.startDate,
          remainingMinutes: remainingMinutes,
          remainingLabel,
          isDone: isDone,
          routineListId: 0,
        });
      }

      result.push({
        routineListId: list.id,
        routineListTitle: list.title,
        categoryId: list.categoryId,
        categoryName: list.category?.name ?? null,
        routines: routineDtos,
      });
    }

    return result;
  }

  private formatRemainingLabel(remainingMinutes: number): string {
    if (remainingMinutes <= 0) return 'Done';

    if (remainingMinutes >= 60) {
      const hours = Math.ceil(remainingMinutes / 60);
      return `${hours} Hours`;
    }
    return `${remainingMinutes} Minutes`;
  }

  async getTodayRoutines(userId: string): Promise<RoutineResponseDto[]> {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // 1. Fetch Personal Routines
    const personalRoutines = await this.routineRepo.find({
      where: {
        userId: userId,
        startDate: LessThanOrEqual(todayString),
      },
      relations: ['routineList'],
    });

    // 2. Fetch Collaborative Memberships
    const memberships = await this.memberRepo.find({
      where: { userId: userId },
      relations: ['routine', 'routine.category'],
    });

    const activeCollabRoutines = memberships
      .filter((m) => m.routine.startDate <= todayString)
      .map((m) => m.routine);

    // 3. Merged logic for individual streak and completion
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // For personal logs
    const personalLogs = await this.logRepo.find({
      where: {
        userId: userId,
        logDate: Between(startOfDay, endOfDay),
        isVerified: true,
      },
      relations: ['routine'],
    });
    const completedPersonalIds = new Set(personalLogs.map((log) => log.routine.id));

    // Process Personal Routines
    const personalResults = personalRoutines
      .filter(
        (r) =>
          r.frequencyType.toLowerCase() === 'daily' || r.frequencyType.toLowerCase() === 'weekly',
      )
      .map((routine) => {
        const [h, m, s] = routine.endTime.split(':').map(Number);
        const endAt = new Date();
        endAt.setHours(h ?? 0, m ?? 0, s ?? 0, 0);

        const now = new Date();
        const diffMs = endAt.getTime() - now.getTime();
        const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

        const remainingLabel =
          routine.frequencyType.toLowerCase() === 'weekly'
            ? 'Pending'
            : this.formatRemainingLabel(remainingMinutes);

        return {
          id: routine.id,
          title: routine.routineName,
          category: routine.routineList?.title || 'General',
          startTime: routine.startTime,
          endTime: routine.endTime,
          frequency: routine.frequencyType,
          isCompleted: completedPersonalIds.has(routine.id),
          remainingLabel: remainingLabel,
          streak: routine.streak,
        };
      });

    // Process Collaborative Routines
    const collabResults = activeCollabRoutines
      .filter(
        (r) =>
          r.frequencyType.toLowerCase() === 'daily' || r.frequencyType.toLowerCase() === 'weekly',
      )
      .map((routine) => {
        const membership = memberships.find((m) => m.collaborativeRoutineId === routine.id);
        const [h, m, s] = routine.endTime.split(':').map(Number);
        const endAt = new Date();
        endAt.setHours(h ?? 0, m ?? 0, s ?? 0, 0);

        const now = new Date();
        const diffMs = endAt.getTime() - now.getTime();
        const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));

        return {
          id: routine.id,
          title: routine.routineName,
          category: routine.category?.name || 'Group',
          startTime: routine.startTime,
          endTime: routine.endTime,
          frequency: routine.frequencyType,
          isCompleted: false, // ... would need collab logs here
          remainingLabel: this.formatRemainingLabel(remainingMinutes),
          streak: membership?.streak ?? 0,
        };
      });

    return [...personalResults, ...collabResults];
  }
}
