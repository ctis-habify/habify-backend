import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, DataSource } from 'typeorm';
import { User } from './users.entity';
import { RoutineLog } from 'src/routine-logs/routine-logs.entity';
import { FriendRequest, FriendRequestStatus } from 'src/friend-requests/friend-requests.entity';
import { Routine } from 'src/routines/routines.entity';
import { CollaborativeRoutine } from 'src/routines/collaborative-routines.entity';
import { RoutineMember } from 'src/routines/routine-members.entity';
import { ProfileResponseDto } from '../common/dto/users/profile-response.dto';
import { FriendProfileResponseDto } from '../common/dto/users/friend-profile-response.dto';
import { UpdateProfileDto } from '../common/dto/users/update-profile.dto';
import { UserSearchResultDto } from '../common/dto/users/user-search-result.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(RoutineLog)
    private readonly logsRepo: Repository<RoutineLog>,

    @InjectRepository(FriendRequest)
    private readonly friendRequestsRepo: Repository<FriendRequest>,

    @InjectRepository(Routine)
    private readonly routinesRepo: Repository<Routine>,

    @InjectRepository(CollaborativeRoutine)
    private readonly collabRoutinesRepo: Repository<CollaborativeRoutine>,

    @InjectRepository(RoutineMember)
    private readonly membersRepo: Repository<RoutineMember>,

    private readonly dataSource: DataSource,
  ) {}

  private readonly logger = new Logger(UsersService.name);

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username } });
  }

  async searchUsers(currentUserId: string, query: string): Promise<UserSearchResultDto[]> {
    const q = (query || '').trim();
    if (!q) return [];

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    const users =
      isUuid && q.length >= 8
        ? await this.usersRepo.find({ where: { id: q } })
        : await this.usersRepo.find({
            where: [{ username: ILike(`${q}%`) }, { name: ILike(`${q}%`) }],
            take: 20,
          });

    return users
      .filter((u) => u.id !== currentUserId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatarUrl,
        totalXp: u.totalXp,
      }));
  }

  private async getFriendList(userId: string): Promise<UserSearchResultDto[]> {
    const accepted = await this.friendRequestsRepo.find({
      where: { status: FriendRequestStatus.accepted },
      relations: ['fromUser', 'toUser'],
    });
    return accepted
      .filter((fr) => fr.fromUserId === userId || fr.toUserId === userId)
      .map((fr) => {
        const p = fr.fromUserId === userId ? fr.toUser : fr.fromUser;
        return {
          id: p.id,
          name: p.name,
          username: p.username,
          avatarUrl: p.avatarUrl,
          totalXp: p.totalXp,
        };
      });
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      age: this.computeAge(user.birthDate),
      birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : null,
      avatarUrl: user.avatarUrl,
      totalXp: user.totalXp,
      dailyStreak: user.dailyStreak,
      friends: await this.getFriendList(userId),
    } as any;
  }

  async getFriendProfile(userId: string): Promise<FriendProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      gender: user.gender ?? null,
      age: this.computeAge(user.birthDate),
      birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : null,
      avatarUrl: user.avatarUrl,
      totalXp: user.totalXp,
      currentStreak: user.dailyStreak,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      friends: await this.getFriendList(userId),
    } as any;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.birthDate !== undefined) {
      user.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.username !== undefined) {
      const val = (dto.username && dto.username.trim()) || null;
      if (val) {
        const existing = await this.findByUsername(val);
        if (existing && existing.id !== userId)
          throw new ConflictException('Username already taken');
      }
      user.username = val;
    }

    await this.usersRepo.save(user);

    return this.getProfile(userId);
  }

  async createUser(dto: RegisterDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already exists');
    if (dto.username) {
      const existingUsername = await this.findByUsername(dto.username);
      if (existingUsername) throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      name: dto.name,
      email: dto.email,
      username: dto.username ?? null,
      gender: dto.gender,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      passwordHash,
      totalXp: 0,
    });

    return this.usersRepo.save(user);
  }

  async setDailyStreak(userId: string, dailyStreak: number, lastStreakDate: string): Promise<void> {
    await this.usersRepo.update(userId, { dailyStreak, lastStreakDate });
  }

  async resetDailyStreak(userId: string): Promise<void> {
    await this.usersRepo.update(userId, { dailyStreak: 0 });
  }

  async setResetPasswordToken(userId: string, token: string, expiresInMs: number): Promise<void> {
    const expires = new Date(Date.now() + expiresInMs);
    await this.usersRepo.update(userId, {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });
  }

  async resetUserPassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.usersRepo.update(userId, {
      passwordHash: newPasswordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });
  }

  async updateLastLogin(user: User): Promise<void> {
    user.lastLoginAt = new Date();
    await this.usersRepo.save(user);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.dataSource.transaction(async (manager) => {
      const ownedCollabRoutines = await manager.find(CollaborativeRoutine, {
        where: { creatorId: userId },
      });

      for (const routine of ownedCollabRoutines) {
        const otherMembers = await manager.find(RoutineMember, {
          where: { collaborativeRoutineId: routine.id },
          order: { joinedAt: 'ASC' },
        });

        const filteredMembers = otherMembers.filter((m) => m.userId !== userId);

        if (filteredMembers.length > 0) {
          const newCreatorMember = filteredMembers[0];
          routine.creatorId = newCreatorMember.userId;
          newCreatorMember.role = 'creator';

          await manager.save(CollaborativeRoutine, routine);
          await manager.save(RoutineMember, newCreatorMember);

          this.logger.log(
            `Transferred ownership of group "${routine.routineName}" to user ${newCreatorMember.userId}`,
          );
        } else {
          await manager.remove(CollaborativeRoutine, routine);
          this.logger.log(`Deleted solo collaborative routine group "${routine.routineName}"`);
        }
      }

      await manager.delete(Routine, { userId });
      this.logger.log(`Cleaned up personal routines for user ${userId}`);

      await manager.delete(User, userId);
      this.logger.log(`User ${userId} record permanently deleted`);
    });
  }

  async getAnalytics(userId: string): Promise<{
    totalXp: number;
    dailyStreak: number;
    personalRoutinesCount: number;
    completedLogsCount: number;
    maxPersonalStreak: number;
    collaborativeRoutinesCount: number;
  }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [personalRoutinesCount, completedLogsCount, maxStreakResult, collaborativeRoutinesCount] =
      await Promise.all([
        this.routinesRepo.count({ where: { userId, active: true } }),
        this.logsRepo.count({ where: { userId, isVerified: true } }),
        this.routinesRepo
          .createQueryBuilder('r')
          .select('COALESCE(MAX(r.streak), 0)', 'maxStreak')
          .where('r.user_id = :userId', { userId })
          .getRawOne<{ maxStreak: string }>(),
        this.membersRepo.count({ where: { userId } }),
      ]);

    return {
      totalXp: user.totalXp ?? 0,
      dailyStreak: user.dailyStreak ?? 0,
      personalRoutinesCount,
      completedLogsCount,
      maxPersonalStreak: parseInt(maxStreakResult?.maxStreak ?? '0', 10),
      collaborativeRoutinesCount,
    };
  }

  private computeAge(birthDate: Date | null): number | null {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }
}
