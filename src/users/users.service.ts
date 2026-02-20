import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { RoutineLog } from 'src/routine-logs/routine-logs.entity';
import { ProfileResponseDto } from '../common/dto/users/profile-response.dto';
import { UpdateProfileDto } from '../common/dto/users/update-profile.dto';

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

  // Returns the user's profile mapped to ProfileResponseDto
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.name = user.name;
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

    await this.usersRepo.save(user);

    return this.getProfile(userId);
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
    });

    return this.usersRepo.save(user);
  }

  // Updates user's last login timestamp
  async updateLastLogin(user: User): Promise<void> {
    user.lastLoginAt = new Date();
    await this.usersRepo.save(user);
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
