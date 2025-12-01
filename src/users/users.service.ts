import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
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
}
