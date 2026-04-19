import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'; // run "npm i bcrypt" (if error taken)
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditLogType } from '../audit-logs/audit-log.entity';


@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // user operations
    private readonly jwtService: JwtService, // JWT utilities
    private readonly auditLogsService: AuditLogsService,
  ) {}


  // Handles user registration
  async register(dto: RegisterDto): Promise<{ user: Partial<User>; accessToken: string }> {
    const user = await this.usersService.createUser(dto);
    const token = await this.generateToken(user);

    await this.auditLogsService.log('REGISTER', AuditLogType.security, user.id, {
      email: user.email,
    });


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
      await this.auditLogsService.log('FAILED_LOGIN', AuditLogType.security, user.id, {
        reason: 'Invalid password',
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    return user;

  }

  // Login flow: validate -> update login time -> return user + token
  async login(
    email: string,
    password: string,
  ): Promise<{ user: Partial<User>; accessToken: string }> {
    const user = await this.validateUser(email, password);

    await this.usersService.updateLastLogin(user); // update last_login_at

    const token = await this.generateToken(user);

    await this.auditLogsService.log('LOGIN', AuditLogType.security, user.id);


    return { user: this.sanitizeUser(user), accessToken: token };

  }

  // Creates a signed JWT token for the given user
  private async generateToken(user: User): Promise<string> {
    const payload = {
      id: user.id,
      sub: user.id, // JWT "subject"
      email: user.email,
      name: user.name,
    };

    return this.jwtService.signAsync(payload);
  }

  // Removes sensitive fields before sending user to client
  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }
}
