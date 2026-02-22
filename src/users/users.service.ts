import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from './users.entity';
import { RoutineLog } from 'src/routine-logs/routine-logs.entity';
import { ProfileResponseDto } from '../common/dto/users/profile-response.dto';
import { UpdateProfileDto } from '../common/dto/users/update-profile.dto';
import { UserSearchResultDto } from '../common/dto/users/user-search-result.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(RoutineLog)
    private readonly logsRepo: Repository<RoutineLog>,
  ) {}

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
      users = await this.usersRepo.find({
        where: [{ username: ILike(`%${q}%`) }, { name: ILike(`%${q}%`) }],
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

  // Returns the user's profile mapped to ProfileResponseDto
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.username = user.username;
    dto.email = user.email;
    dto.age = this.computeAge(user.birthDate);
    dto.avatarUrl = user.avatarUrl;
    dto.totalXp = user.totalXp;

    return dto;
  }

  // Updates profile fields (name, avatarUrl)
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
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

  // Updates user's last login timestamp
  async updateLastLogin(user: User): Promise<void> {
    user.lastLoginAt = new Date();
    await this.usersRepo.save(user);
  }

  // Permanently deletes the user's account
  async deleteAccount(userId: string): Promise<void> {
    const result = await this.usersRepo.delete(userId);
    if (!result.affected) throw new NotFoundException('User not found');
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
