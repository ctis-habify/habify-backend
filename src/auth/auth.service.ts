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
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: Partial<User>; accessToken: string }> {
    const user = await this.usersService.createUser(dto);
    const token = await this.generateToken(user);

    await this.auditLogsService.log('REGISTER', AuditLogType.security, user.id, {
      email: user.email,
    });

    return { user: this.sanitizeUser(user), accessToken: token };
  }

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

  async login(
    email: string,
    password: string,
    rememberMe?: boolean,
  ): Promise<{ user: Partial<User>; accessToken: string }> {
    const user = await this.validateUser(email, password);

    await this.usersService.updateLastLogin(user);

    const token = await this.generateToken(user, rememberMe);

    await this.auditLogsService.log('LOGIN', AuditLogType.security, user.id);

    return { user: this.sanitizeUser(user), accessToken: token };
  }

  private async generateToken(user: User, rememberMe?: boolean): Promise<string> {
    const payload = {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: rememberMe ? '30d' : '7d',
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

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

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.resetUserPassword(user.id, newPasswordHash);

    await this.auditLogsService.log('PASSWORD_RESET_COMPLETED', AuditLogType.security, user.id);
  }

  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }
}
