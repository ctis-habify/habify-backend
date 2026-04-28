import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, type Repository } from 'typeorm';
import type { CreatePersonalRoutineDto } from '../common/dto/routines/create-routines.dto';
import { PersonalRoutine  } from './routines.entity';
import { isStreakBroken, isCompletedInCurrentCycle } from './routine-cycle.util';
import { Category } from 'src/categories/categories.entity';
import { CreateCollaborativeRoutineDto } from 'src/common/dto/routines/create-collaborative-routine.dto';
import { GroupDetailResponseDto } from 'src/common/dto/routines/group-detail-response.dto';
import { PersonalRoutineListWithRoutinesDto } from 'src/common/dto/routines/routine-list-with-routines.dto';
import { PublicCollaborativeRoutineResponseDto } from 'src/common/dto/routines/public-collaborative-routine-response.dto';
import { TodayScreenResponseDto } from 'src/common/dto/routines/today-screen-response.dto';
import { PersonalRoutineList } from 'src/routine-lists/routine-lists.entity';
import { Gender, User } from 'src/users/users.entity';
import { UsersService } from 'src/users/users.service';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { CollaborativeRoutineMember } from './routine-members.entity';
import { CollaborativeScoreService } from 'src/collaborative-score/collaborative-score.service';
import { PersonalRoutineLog } from '../routine-logs/routine-logs.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditLogType } from '../audit-logs/audit-log.entity';
import { randomBytes } from 'crypto';
import { CollaborativeRoutineViewDto } from '../common/dto/routines/collaborative-routine-view.dto';
import { PersonalRoutineResponseDto } from '../common/dto/routines/routine-response.dto';
import { UpdatePersonalRoutineDto } from '../common/dto/routines/update-routine.dto';

@Injectable()
export class RoutinesService {
  private readonly logger = new Logger(RoutinesService.name);

  constructor(
    @InjectRepository(PersonalRoutineList)
    private readonly routineListRepo: Repository<PersonalRoutineList>,

    @InjectRepository(PersonalRoutineLog)
    private readonly logRepo: Repository<PersonalRoutineLog>,

    @InjectRepository(PersonalRoutine)
    private routineRepo: Repository<PersonalRoutine>,
    @InjectRepository(CollaborativeRoutine)
    private collaborativeRoutineRepo: Repository<CollaborativeRoutine>,
    @InjectRepository(CollaborativeRoutineMember)
    private memberRepo: Repository<CollaborativeRoutineMember>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly usersService: UsersService,
    private readonly collaborativeScoreService: CollaborativeScoreService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getUserPersonalRoutines(userId: string): Promise<PersonalRoutine[]> {
    return this.routineRepo.find({
      where: { userId: userId },
      order: { startTime: 'ASC' },
    });
  }

  async getPersonalRoutineById(userId: string, routineId: string): Promise<PersonalRoutine | null> {
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

  private async getOrCreateDefaultList(userId: string): Promise<number> {
    let list = await this.routineListRepo.findOne({
      where: { userId, title: 'General' },
    });
    if (!list) {
      let generalCategory = await this.categoryRepo.findOne({
        where: { name: 'General' },
      });
      if (!generalCategory) {
        generalCategory = await this.categoryRepo.save(
          this.categoryRepo.create({ name: 'General', type: 'personal' }),
        );
      }
      list = await this.routineListRepo.save(
        this.routineListRepo.create({ userId, title: 'General', categoryId: generalCategory.id }),
      );
    }
    return list.id;
  }

  async createPersonalRoutine(data: CreatePersonalRoutineDto & { userId: string }): Promise<PersonalRoutine> {
    const listId = data.routineListId ?? (await this.getOrCreateDefaultList(data.userId));

    const routine = this.routineRepo.create({
      userId: data.userId,
      routineListId: listId,
      routineName: data.routineName,
      frequencyType: data.frequencyType,
      startTime: data.startTime ?? '00:00:00',
      endTime: data.endTime ?? '23:59:59',
      startDate: data.startDate,
      isAiVerified: false,
    });

    const saved = await this.routineRepo.save(routine);

    await this.auditLogsService.log('ROUTINE_CREATE', AuditLogType.operational, data.userId, {
      routineId: saved.id,
      name: saved.routineName,
    });

    return saved;
  }

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
      endDate: data.endDate ?? null,
    });

    const saved = await this.collaborativeRoutineRepo.save(routine);

    const creatorMember = this.memberRepo.create({
      collaborativeRoutineId: saved.id,
      userId: data.userId,
      role: 'creator',
      streak: 0,
      missedCount: 0,
    });
    await this.memberRepo.save(creatorMember);

    await this.auditLogsService.log(
      'COLLABORATIVE_ROUTINE_CREATE',
      AuditLogType.operational,
      data.userId,
      {
        routineId: saved.id,
        name: saved.routineName,
      },
    );

    return saved;
  }

  async joinRoutine(userId: string, key: string): Promise<{ message: string }> {
    const routine = await this.collaborativeRoutineRepo.findOne({
      where: { collaborativeKey: key.toUpperCase() },
    });

    if (!routine) {
      throw new NotFoundException('Collaborative routine not found with this key');
    }

    return this.checkAndCreateMembership(userId, routine);
  }

  async browsePublicRoutines(
    userId: string,
    search?: string,
    categoryId?: number,
    frequencyType?: string,
    gender?: string,
    age?: number,
    xp?: number,
    memberId?: string,
  ): Promise<PublicCollaborativeRoutineResponseDto[]> {
    const qb = this.collaborativeRoutineRepo
      .createQueryBuilder('routine')
      .leftJoinAndSelect('routine.category', 'category')
      .leftJoinAndSelect('routine.members', 'members')
      .where('routine.isPublic = :isPublic', { isPublic: true })
      .orderBy('routine.createdAt', 'DESC');

    if (search) qb.andWhere('routine.routineName ILIKE :search', { search: `%${search}%` });
    if (categoryId) qb.andWhere('routine.categoryId = :categoryId', { categoryId });
    if (frequencyType) qb.andWhere('routine.frequencyType = :frequencyType', { frequencyType });
    if (gender) qb.andWhere('routine.genderRequirement = :gender', { gender });
    if (age) qb.andWhere('routine.ageRequirement <= :age', { age });
    if (xp) qb.andWhere('routine.xpRequirement <= :xp', { xp });
    if (memberId) {
      qb.innerJoin('routine.members', 'targetMember', 'targetMember.userId = :memberId', {
        memberId,
      });
    }

    const routines = await qb.getMany();

    return routines.map((routine) => ({
      id: routine.id,
      routineName: routine.routineName,
      description: routine.description ?? null,
      category: routine.category?.name ?? null,
      categoryId: routine.categoryId,
      startDate: routine.startDate,
      frequencyType: routine.frequencyType,
      memberCount: routine.members?.length ?? 0,
      isAlreadyMember: (routine.members ?? []).some((m) => m.userId === userId),
      ageRequirement: routine.ageRequirement,
      genderRequirement: routine.genderRequirement,
      xpRequirement: routine.xpRequirement,
      createdAt: routine.createdAt,
    }));
  }

  async joinPublicRoutine(userId: string, routineId: string): Promise<{ message: string }> {
    const routine = await this.collaborativeRoutineRepo.findOne({
      where: { id: routineId },
    });

    if (!routine) {
      throw new NotFoundException('Collaborative routine not found');
    }

    if (!routine.isPublic) {
      throw new BadRequestException('This routine is not public and cannot be joined this way');
    }

    return this.checkAndCreateMembership(userId, routine);
  }

  private async checkAndCreateMembership(
    userId: string,
    routine: CollaborativeRoutine,
  ): Promise<{ message: string }> {
    const existing = await this.memberRepo.findOne({
      where: { userId, collaborativeRoutineId: routine.id },
    });

    if (existing) {
      return { message: 'You are already a member of this routine group' };
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

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

    if (routine.genderRequirement && routine.genderRequirement !== Gender.na) {
      if (user.gender !== routine.genderRequirement) {
        throw new BadRequestException(
          `This routine is only for ${routine.genderRequirement} members`,
        );
      }
    }

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

  private async syncStreak(
    entity: PersonalRoutine | CollaborativeRoutineMember,
    todayStrOverride?: string,
  ): Promise<number> {
    const todayStr = todayStrOverride || new Date().toISOString().split('T')[0];
    const lastDone = entity.lastCompletedDate;

    const isRoutine = 'routineName' in entity;
    const frequencyType = isRoutine
      ? (entity as PersonalRoutine).frequencyType
      : ((entity as CollaborativeRoutineMember).routine?.frequencyType ?? 'daily');
    const startDate = isRoutine
      ? (entity as PersonalRoutine).startDate
      : ((entity as CollaborativeRoutineMember).routine?.startDate ?? todayStr);

    if (isRoutine) {
      const routine = entity as PersonalRoutine;
      const completedNow = isCompletedInCurrentCycle(frequencyType, startDate, lastDone, todayStr);
      if (routine.isAiVerified && !completedNow) {
        routine.isAiVerified = false;
        await this.routineRepo.save(routine);
      }
    }

    if (!lastDone) return 0;

    if (isStreakBroken(frequencyType, startDate, lastDone, todayStr) && entity.streak > 0) {
      entity.streak = 0;
      if (isRoutine) {
        await this.routineRepo.save(entity as PersonalRoutine);
      } else {
        await this.memberRepo.save(entity as CollaborativeRoutineMember);
      }
    }

    return entity.streak;
  }

  async getCollaborativeRoutines(userId: string): Promise<CollaborativeRoutine[]> {
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
    if (!routine) throw new NotFoundException('Group not found');

    const cups = await this.collaborativeScoreService.getCupMapForUsers(
      routine.members.map((m) => m.userId),
    );
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
        userId: m.user.id,
        username: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        streak: m.streak,
        joinedAt: m.joinedAt,
        cup: cups[m.userId] ?? null,
        cupTier: cups[m.userId]?.tier ?? null,
      })),
    };
  }

  async removeMember(
    requesterId: string,
    routineId: string,
    targetId: string,
  ): Promise<{ message: string }> {
    const routine = await this.getCollaborativeRoutineById(routineId);
    if (!routine) throw new NotFoundException('Group not found');

    const members = await this.memberRepo.find({
      where: { collaborativeRoutineId: routineId },
      relations: ['user'],
    });
    const requester = members.find((m) => m.userId === requesterId);
    const target = members.find((m) => m.userId === targetId || m.user?.username === targetId);
    if (!requester || !target) throw new ForbiddenException('Access denied');

    if (requesterId !== target.userId && requester.role !== 'creator') {
      throw new ForbiddenException('Only creator can remove others');
    }

    if (target.role === 'creator') {
      const next = members.find((m) => m.userId !== target.userId);
      if (next) {
        next.role = 'creator';
        routine.creatorId = next.userId;
        await Promise.all([
          this.memberRepo.save(next),
          this.collaborativeRoutineRepo.save(routine),
        ]);
      } else {
        await this.collaborativeRoutineRepo.remove(routine);
        return { message: 'CollaborativeRoutine deleted' };
      }
    }

    await this.memberRepo.remove(target);
    return { message: 'Member removed' };
  }

  async handleCreatorDefeat(routineId: string): Promise<{ message: string }> {
    const routine = await this.collaborativeRoutineRepo.findOne({
      where: { id: routineId },
      relations: ['members'],
    });
    if (!routine) throw new NotFoundException('Group not found');

    const others = routine.members.filter((m) => m.role !== 'creator');
    if (others.length === 0) {
      await this.collaborativeRoutineRepo.delete(routineId);
      return { message: 'CollaborativeRoutine deleted' };
    }

    const creator = routine.members.find((m) => m.role === 'creator');
    const next = others[Math.floor(Math.random() * others.length)];
    next.role = 'creator';
    routine.creatorId = next.userId;

    await Promise.all([
      this.memberRepo.save(next),
      this.collaborativeRoutineRepo.save(routine),
      creator ? this.memberRepo.remove(creator) : Promise.resolve(),
    ]);

    return { message: 'New creator assigned' };
  }

  async updateRoutine(
    userId: string,
    routineId: string,
    dto: UpdatePersonalRoutineDto,
  ): Promise<PersonalRoutine | CollaborativeRoutine> {
    const personal = await this.routineRepo.findOne({ where: { id: routineId, userId } });
    if (personal) {
      const oldFreq = personal.frequencyType?.toLowerCase();
      if (dto.routineName) personal.routineName = dto.routineName;
      if (dto.frequencyType) personal.frequencyType = dto.frequencyType;
      if (dto.startDate) personal.startDate = dto.startDate;
      if (oldFreq === 'daily' && dto.frequencyType?.toLowerCase() === 'weekly') {
        personal.startTime = '00:00:00';
        personal.endTime = '23:59:59';
      } else {
        if (dto.startTime) personal.startTime = dto.startTime;
        if (dto.endTime) personal.endTime = dto.endTime;
      }
      if (dto.active !== undefined) personal.active = dto.active;
      return this.routineRepo.save(personal);
    }

    const collab = await this.collaborativeRoutineRepo.findOne({
      where: { id: routineId, creatorId: userId },
    });
    if (collab) {
      if (dto.routineName) collab.routineName = dto.routineName;
      if (dto.frequencyType) collab.frequencyType = dto.frequencyType;
      if (dto.startDate) collab.startDate = dto.startDate;
      if (dto.startTime) collab.startTime = dto.startTime;
      if (dto.endTime) collab.endTime = dto.endTime;
      return this.collaborativeRoutineRepo.save(collab);
    }
    throw new NotFoundException('Routine not found');
  }

  async deleteRoutine(userId: string, routineId: string): Promise<{ message: string }> {
    const personal = await this.routineRepo.findOne({ where: { id: routineId, userId } });
    if (personal) {
      await this.routineRepo.remove(personal);
      await this.auditLogsService.log('ROUTINE_DELETE', AuditLogType.operational, userId, {
        routineId,
        type: 'personal',
      });
      return { message: 'Deleted' };
    }

    const collab = await this.collaborativeRoutineRepo.findOne({
      where: { id: routineId, creatorId: userId },
    });
    if (collab) {
      await this.collaborativeRoutineRepo.remove(collab);
      await this.auditLogsService.log('ROUTINE_DELETE', AuditLogType.operational, userId, {
        routineId,
        type: 'collaborative',
      });
      return { message: 'Deleted' };
    }
    throw new NotFoundException('Routine not found');
  }

  async getAllRoutinesByList(
    userId: string,
    todayStr?: string,
  ): Promise<PersonalRoutineListWithRoutinesDto[]> {
    const today = todayStr || new Date().toISOString().split('T')[0];
    const lists = await this.routineListRepo.find({
      where: { userId },
      relations: ['category', 'routines'],
      order: { id: 'ASC' },
    });

    return Promise.all(
      lists.map(async (list) => ({
        routineListId: list.id,
        routineListTitle: list.title,
        categoryId: list.categoryId,
        categoryName: list.category?.name || 'General',
        routines: await Promise.all(
          (list.routines ?? []).map(async (r) => {
            const { remainingMinutes } = this.getRoutineTiming(r.endTime);
            return {
              id: r.id,
              routineName: r.routineName,
              routineListId: r.routineListId,
              frequencyType: r.frequencyType,
              startTime: r.startTime,
              endTime: r.endTime,
              startDate: r.startDate,
              remainingMinutes,
              remainingLabel: this.formatRemainingLabel(remainingMinutes),
              isDone: r.isAiVerified,
              streak: await this.syncStreak(r, today),
            };
          }),
        ),
      })),
    );
  }

  private formatRemainingLabel(remainingMinutes: number): string {
    if (remainingMinutes <= 0) return 'Done';
    if (remainingMinutes >= 60) return `${Math.ceil(remainingMinutes / 60)} Hours`;
    return `${remainingMinutes} Minutes`;
  }

  private getRoutineTiming(endTime: string) {
    const [h, m, s] = endTime.split(':').map(Number);
    const endAt = new Date();
    endAt.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
    const diffMs = endAt.getTime() - new Date().getTime();
    const remainingMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));
    return { endAt, remainingMinutes };
  }

  async getTodayRoutines(userId: string, todayStr?: string): Promise<TodayScreenResponseDto> {
    const todayString = todayStr || new Date().toISOString().split('T')[0];

    const [personalRoutines, memberships] = await Promise.all([
      this.routineRepo.find({
        where: { userId, startDate: LessThanOrEqual(todayString) },
        relations: ['routineList'],
      }),
      this.memberRepo.find({
        where: { userId },
        relations: ['routine', 'routine.category'],
      }),
    ]);

    const routines: PersonalRoutineResponseDto[] = [];

    for (const routine of personalRoutines) {
      const { remainingMinutes } = this.getRoutineTiming(routine.endTime);
      routines.push({
        id: routine.id,
        title: routine.routineName,
        category: routine.routineList?.title || 'General',
        startTime: routine.startTime,
        endTime: routine.endTime,
        frequency: routine.frequencyType,
        isCompleted: routine.isAiVerified,
        remainingLabel:
          routine.frequencyType.toLowerCase() === 'weekly'
            ? 'Pending'
            : this.formatRemainingLabel(remainingMinutes),
        streak: await this.syncStreak(routine, todayString),
      });
    }

    for (const m of memberships) {
      if (m.routine.startDate > todayString) continue;
      const { remainingMinutes } = this.getRoutineTiming(m.routine.endTime);
      routines.push({
        id: m.routine.id,
        title: m.routine.routineName,
        category: m.routine.category?.name || 'Group',
        startTime: m.routine.startTime,
        endTime: m.routine.endTime,
        frequency: m.routine.frequencyType,
        isCompleted: isCompletedInCurrentCycle(
          m.routine.frequencyType,
          m.routine.startDate,
          m.lastCompletedDate,
          todayString,
        ),
        remainingLabel: this.formatRemainingLabel(remainingMinutes),
        streak: await this.syncStreak(m, todayString),
      });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let streak = user.dailyStreak ?? 0;
    const yesterdayStr = new Date(new Date(todayString).getTime() - 86400000)
      .toISOString()
      .split('T')[0];

    if (
      user.lastStreakDate &&
      user.lastStreakDate !== todayString &&
      user.lastStreakDate !== yesterdayStr &&
      user.dailyStreak > 0
    ) {
      await this.userRepo.update(userId, { dailyStreak: 0 });
      streak = 0;
    }

    const hasAnyFailureToday = routines.some(
      (r) => !r.isCompleted && new Date() > this.getRoutineTiming(r.endTime).endAt,
    );
    if (hasAnyFailureToday) streak = 0;

    return { routines, streak };
  }

  async viewCollaborativeRoutines(userId: string): Promise<CollaborativeRoutineViewDto[]> {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['routine', 'routine.category', 'routine.members', 'routine.members.user'],
    });

    const enrolledUserIds = memberships.flatMap((membership) =>
      membership.routine.members.map((member: CollaborativeRoutineMember) => member.userId),
    );
    const cupsByUserId = await this.collaborativeScoreService.getCupMapForUsers(enrolledUserIds);

    return memberships.map((m) => {
      const routine = m.routine as CollaborativeRoutine;
      return {
        id: routine.id,
        name: routine.routineName,
        description: routine.description,
        enrolledUsers: routine.members.map((member: CollaborativeRoutineMember) => ({
          userId: member.user.id,
          username: member.user.name,
          avatarUrl: member.user.avatarUrl,
          cup: cupsByUserId[member.userId] ?? null,
          cupTier: cupsByUserId[member.userId]?.tier ?? null,
        })),
      };
    });
  }
}
