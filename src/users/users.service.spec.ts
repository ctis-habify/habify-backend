import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { FriendRequest } from '../friend-requests/friend-requests.entity';
import { Routine } from '../routines/routines.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { RoutineMember } from '../routines/routine-members.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DataSource } from 'typeorm';

describe('UsersService (Unit)', () => {
  let service: UsersService;

  const mockRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockXpLogsService = {
    getTotalXP: jest.fn(),
  };

  const mockAuditLogsService = {
    log: jest.fn(),
  };

  const mockNotificationsService = {
    createAndPush: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(FriendRequest), useValue: mockRepo },
        { provide: getRepositoryToken(Routine), useValue: mockRepo },
        { provide: getRepositoryToken(CollaborativeRoutine), useValue: mockRepo },
        { provide: getRepositoryToken(RoutineMember), useValue: mockRepo },
        { provide: getRepositoryToken(RoutineLog), useValue: mockRepo },
        { provide: getRepositoryToken(CollaborativeRoutineLog), useValue: mockRepo },
        { provide: XpLogsService, useValue: mockXpLogsService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('findById should return user', async () => {
    const user = { id: 'u-1', name: 'T' };
    mockRepo.findOne.mockResolvedValue(user);
    const result = await service.findById('u-1');
    expect(result).toEqual(user);
  });
});
