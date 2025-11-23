import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../auth/dto/register.dto';
import { Gender } from './users.entity';

// -----------------------------------------------------------------------
//  DB (TypeORM) implementation – for production use
//  (We keep this commented out while developing with an in-memory store)
// -----------------------------------------------------------------------
//
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { User } from './users.entity';
//
// @Injectable()
// export class UsersService {
//   constructor(
//     @InjectRepository(User)
//     private readonly usersRepo: Repository<User>,
//   ) {}
//
//   // Finds a user by email using the database
//   async findByEmail(email: string): Promise<User | null> {
//     return this.usersRepo.findOne({ where: { email } });
//   }
//
//   // Creates a new user record in the database
//   async createUser(dto: RegisterDto): Promise<User> {
//     const existing = await this.findByEmail(dto.email);
//     if (existing) throw new ConflictException('Email already exists');
//
//     const passwordHash = await bcrypt.hash(dto.password, 10);
//
//     const user = this.usersRepo.create({
//       name: dto.name,
//       email: dto.email,
//       gender: dto.gender,
//       birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
//       passwordHash,
//       totalXp: 0,
//       currentStreak: 0,
//     });
//
//     return this.usersRepo.save(user);
//   }
//
//   // Updates user's last login timestamp
//   async updateLastLogin(user: User) {
//     user.lastLoginAt = new Date();
//     await this.usersRepo.save(user);
//   }
// }
//
// -----------------------------------------------------------------------
//  IN-MEMORY (HashMap) implementation – for local development
//  No database required. Everything resets on server restart.
// -----------------------------------------------------------------------

type InMemoryUser = {
  id: string;
  name: string;
  email: string;
  gender: Gender | null;
  birthDate: Date | null;
  passwordHash: string;
  totalXp: number;
  currentStreak: number;
  createdAt: Date;
  lastLoginAt: Date | null;
  updatedAt: Date;
  fcmToken: string | null;
};

@Injectable()
export class UsersService {
  // Simple in-memory store acting as a temporary database
  private users = new Map<string, InMemoryUser>();

  // Finds a user by email inside the in-memory store
  async findByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  // Creates a new user and stores it in memory
  async createUser(dto: RegisterDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already exists');

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = {
      id,
      name: dto.name,
      email: dto.email,
      gender: dto.gender || null,
      birthDate: dto.birthDate || null,
      passwordHash,
      totalXp: 0,
      currentStreak: 0,
      createdAt: new Date(),
      lastLoginAt: null,
      updatedAt: new Date(),
      fcmToken: null,
    };

    this.users.set(id, user);
    return user;
  }

  // Updates the user's last login timestamp (dev mode)
  async updateLastLogin(user: InMemoryUser) {
    user.lastLoginAt = new Date();
    this.users.set(user.id, user);
  }

  // Returns all users stored in memory
  findAll() {
    return Array.from(this.users.values());
  }
}
