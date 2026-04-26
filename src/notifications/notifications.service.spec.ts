import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './notifications.entity';
import { User } from '../users/users.entity';
import { Routine } from '../routines/routines.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { RoutineMember } from '../routines/routine-members.entity';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { ConfigService } from '@nestjs/config';

describe('NotificationsService (Unit)', () => {
  let service: NotificationsService;

  const mockRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'n-1', ...dto })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'EXPO_ACCESS_TOKEN') return 'mock-token';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: mockRepo },
        { provide: getRepositoryToken(Routine), useValue: mockRepo },
        { provide: getRepositoryToken(RoutineLog), useValue: mockRepo },
        { provide: getRepositoryToken(CollaborativeRoutine), useValue: mockRepo },
        { provide: getRepositoryToken(RoutineMember), useValue: mockRepo },
        { provide: getRepositoryToken(CollaborativeRoutineLog), useValue: mockRepo },
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('createAndPush should work', async () => {
    mockRepo.find.mockResolvedValue([]); // No push tokens mock
    const dto = { userId: 'u-1', title: 'T', body: 'B', type: 'test' as any };
    const result = await service.createAndPush(dto);
    expect(result.id).toBe('n-1');
  });
});
