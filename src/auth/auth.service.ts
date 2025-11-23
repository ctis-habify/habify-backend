import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'; // run "npm i bcrypt" (if error taken)
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // user operations
    private readonly jwtService: JwtService, // JWT utilities
  ) {}

  // Handles user registration
  async register(dto: RegisterDto) {
    const user = await this.usersService.createUser(dto);
    const token = await this.generateToken(user);
    return { user: this.sanitizeUser(user), accessToken: token };
  }

  // Validates email + password pair
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  // Login flow: validate -> update login time -> return user + token
  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    await this.usersService.updateLastLogin(user); // update last_login_at

    const token = await this.generateToken(user);
    return { user: this.sanitizeUser(user), accessToken: token };
  }

  // Creates a signed JWT token for the given user
  private async generateToken(user: User): Promise<string> {
    const payload = {
      sub: user.id, // JWT "subject"
      email: user.email,
      name: user.name,
    };

    return this.jwtService.signAsync(payload);
  }

  // Removes sensitive fields before sending user to client
  private sanitizeUser(user: User) {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }
}
