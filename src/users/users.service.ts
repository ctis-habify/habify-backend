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

  // Finds a user by email using the database
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  // Finds a user by ID
  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username } });
  }

  /** Search by ID (exact), username or name (partial). Excludes current user. Max 20. */
  async searchUsers(currentUserId: string, query: string): Promise<UserSearchResultDto[]> {
    const q = (query || '').trim();
    if (!q) return [];

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    let users: User[];

    if (isUuid && q.length >= 8) {
      const user = await this.usersRepo.findOne({ where: { id: q } });
      users = user && user.id !== currentUserId ? [user] : [];
    } else {
      // İsim veya username yazdığın harfle başlayanları getir
      users = await this.usersRepo.find({
        where: [{ username: ILike(`${q}%`) }, { name: ILike(`${q}%`) }],
        take: 20,
      });
      users = users.filter((u) => u.id !== currentUserId);
    }

    return users.map((u) => {
      const dto = new UserSearchResultDto();
      dto.id = u.id;
      dto.name = u.name;
      dto.username = u.username;
      dto.avatarUrl = u.avatarUrl;
      dto.totalXp = u.totalXp;
      return dto;
    });
  }

  // Returns the user's profile mapped to ProfileResponseDto, including their friend list
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const acceptedRequests = await this.friendRequestsRepo.find({
      where: { status: FriendRequestStatus.accepted },
      relations: ['fromUser', 'toUser'],
    });

    const friends = acceptedRequests
      .filter((fr) => fr.fromUserId === userId || fr.toUserId === userId)
      .map((fr) => {
        const peer = fr.fromUserId === userId ? fr.toUser : fr.fromUser;
        const friendDto = new UserSearchResultDto();
        friendDto.id = peer.id;
        friendDto.name = peer.name;
        friendDto.username = peer.username;
        friendDto.avatarUrl = peer.avatarUrl;
        friendDto.totalXp = peer.totalXp;
        return friendDto;
      });

    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.username = user.username;
    dto.email = user.email;
    dto.age = this.computeAge(user.birthDate);
    dto.birthDate = user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : null;
    dto.avatarUrl = user.avatarUrl;
    dto.totalXp = user.totalXp;
    dto.dailyStreak = user.dailyStreak;
    dto.friends = friends;

    return dto;
  }

  async getFriendProfile(userId: string): Promise<FriendProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const acceptedRequests = await this.friendRequestsRepo.find({
      where: { status: FriendRequestStatus.accepted },
      relations: ['fromUser', 'toUser'],
    });

    const friends = acceptedRequests
      .filter((fr) => fr.fromUserId === userId || fr.toUserId === userId)
      .map((fr) => {
        const peer = fr.fromUserId === userId ? fr.toUser : fr.fromUser;
        const friendDto = new UserSearchResultDto();
        friendDto.id = peer.id;
        friendDto.name = peer.name;
        friendDto.username = peer.username;
        friendDto.avatarUrl = peer.avatarUrl;
        friendDto.totalXp = peer.totalXp;
        return friendDto;
      });

    const dto = new FriendProfileResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.username = user.username;
    dto.email = user.email;
    dto.gender = user.gender ?? null;
    dto.age = this.computeAge(user.birthDate);
    dto.birthDate = user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : null;
    dto.avatarUrl = user.avatarUrl;
    dto.totalXp = user.totalXp;
    dto.currentStreak = user.dailyStreak;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    dto.friends = friends;

    return dto;
  }

  // Updates profile fields (name, avatarUrl, birthDate)
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

  // Creates a new user record in the database
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

  // Updates user's last login timestamp
  async updateLastLogin(user: User): Promise<void> {
    user.lastLoginAt = new Date();
    await this.usersRepo.save(user);
  }

  // Permanently deletes the user's account and handles routine ownership transfer/cleanup
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.dataSource.transaction(async (manager) => {
      // 1. Handle Collaborative Routines where user is the creator
      const ownedCollabRoutines = await manager.find(CollaborativeRoutine, {
        where: { creatorId: userId },
      });

      for (const routine of ownedCollabRoutines) {
        // Find other members to transfer ownership
        const otherMembers = await manager.find(RoutineMember, {
          where: { collaborativeRoutineId: routine.id },
          order: { joinedAt: 'ASC' },
        });

        const filteredMembers = otherMembers.filter((m) => m.userId !== userId);

        if (filteredMembers.length > 0) {
          // Transfer ownership to the oldest member
          const newCreatorMember = filteredMembers[0];
          routine.creatorId = newCreatorMember.userId;
          newCreatorMember.role = 'creator';

          await manager.save(CollaborativeRoutine, routine);
          await manager.save(RoutineMember, newCreatorMember);

          this.logger.log(
            `Transferred ownership of group "${routine.routineName}" to user ${newCreatorMember.userId}`,
          );
        } else {
          // User is the only member, delete the group
          // cascade will handle members and logs
          await manager.remove(CollaborativeRoutine, routine);
          this.logger.log(`Deleted solo collaborative routine group "${routine.routineName}"`);
        }
      }

      // 2. Delete Personal Routines
      // Personal logs and notifications will cascade delete if configured in DB,
      // but we ensure clean removal here.
      await manager.delete(Routine, { userId });
      this.logger.log(`Cleaned up personal routines for user ${userId}`);

      // 3. Delete the user
      // Friend requests, memberships, and notifications will cascade delete due to Entity decorators
      await manager.delete(User, userId);
      this.logger.log(`User ${userId} record permanently deleted`);
    });
  }

  // Computes user's age from birthDate
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
