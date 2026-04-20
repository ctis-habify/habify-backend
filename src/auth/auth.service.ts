import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'; // run "npm i bcrypt" (if error taken)
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
import { RegisterDto } from '../common/dto/auth/register.dto';
import { ResetPasswordDto } from '../common/dto/auth/reset-password.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditLogType } from '../audit-logs/audit-log.entity';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, // user operations
    private readonly jwtService: JwtService, // JWT utilities
    private readonly auditLogsService: AuditLogsService,
    private readonly mailService: MailService,
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

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Return early without throwing error to prevent email enumeration
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresInMs = 1000 * 60 * 60; // 1 hour

    await this.usersService.setResetPasswordToken(user.id, token, expiresInMs);

    await this.auditLogsService.log('PASSWORD_RESET_REQUESTED', AuditLogType.security, user.id, {
      email,
    });

    await this.mailService.sendPasswordResetEmail(email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Invalid or expired token.');
    }

    if (!user.resetPasswordToken || user.resetPasswordToken !== dto.token) {
      throw new BadRequestException('Invalid or expired token.');
    }

    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
      throw new BadRequestException('Invalid or expired token.');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.resetUserPassword(user.id, newPasswordHash);

    await this.auditLogsService.log('PASSWORD_RESET_COMPLETED', AuditLogType.security, user.id);
  }

  // Removes sensitive fields before sending user to client
  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }
}
