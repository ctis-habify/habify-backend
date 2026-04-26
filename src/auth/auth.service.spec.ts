import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService (Unit)', () => {
  let service: AuthService;

  const mockUsersService = {
    createUser: jest.fn(),
    findByEmail: jest.fn(),
    updateUser: jest.fn(),
    updateLastLogin: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockAuditLogsService = {
    log: jest.fn(),
  };

  const mockMailService = {
    sendPasswordReset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(service.validateUser('test@test.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'u-1', passwordHash: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('test@test.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user if credentials are valid', async () => {
      const user = { id: 'u-1', email: 'test@test.com', passwordHash: 'hashed' };
      mockUsersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@test.com', 'correct');
      expect(result).toEqual(user);
    });
  });

  describe('login', () => {
    it('should return user and access token', async () => {
      const user = { id: 'u-1', email: 'test@test.com', passwordHash: 'hashed', name: 'Test' };
      mockUsersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.login('test@test.com', 'correct');

      expect(result.user.id).toBe('u-1');
      expect(result.accessToken).toBe('mock-token');
      expect(mockAuditLogsService.log).toHaveBeenCalledWith('LOGIN', expect.anything(), 'u-1');
    });
  });
});
