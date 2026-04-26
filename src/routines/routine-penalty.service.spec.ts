import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoutinePenaltyService } from './routine-penalty.service';
import { Routine } from './routines.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineMember } from './routine-members.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { User } from '../users/users.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('RoutinePenaltyService (Unit)', () => {
  let service: RoutinePenaltyService;

  const mockRepo = {
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  const mockXpLogsService = {
    deductXP: jest.fn(),
  };

  const mockNotificationsService = {
    createAndPush: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinePenaltyService,
        { provide: getRepositoryToken(Routine), useValue: mockRepo },
        { provide: getRepositoryToken(CollaborativeRoutine), useValue: mockRepo },
        { provide: getRepositoryToken(RoutineMember), useValue: mockRepo },
        { provide: getRepositoryToken(RoutineLog), useValue: mockRepo },
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: XpLogsService, useValue: mockXpLogsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<RoutinePenaltyService>(RoutinePenaltyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPersonalPenalties', () => {
    it('should penalize user for missed daily routine', async () => {
      const yesterdayStr = '2020-01-10';
      const mockRoutine = {
        id: 'r-1',
        userId: 'u-1',
        frequencyType: 'daily',
        startDate: '2020-01-01',
        lastCompletedDate: '2020-01-08', // Missed 09 and 10
        missedCount: 0,
        streak: 5,
        routineName: 'Water',
      };

      mockRepo.find.mockResolvedValue([mockRoutine]);

      await (service as any).processPersonalPenalties(yesterdayStr);

      expect(mockXpLogsService.deductXP).toHaveBeenCalledWith('u-1', 10, 'ROUTINE_MISSED');
      expect(mockNotificationsService.createAndPush).toHaveBeenCalled();
      expect(mockRoutine.streak).toBe(0);
      expect(mockRoutine.missedCount).toBe(1);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('processCollaborativePenalties', () => {
    it('should deduct group life if a member misses', async () => {
      const yesterdayStr = '2020-01-10';
      const mockMember = {
        userId: 'u-1',
        lastCompletedDate: '2020-01-08',
        missedCount: 0,
        streak: 5,
      };
      const mockRoutine = {
        id: 'collab-1',
        frequencyType: 'daily',
        startDate: '2020-01-01',
        lives: 3,
        routineName: 'Group Run',
        members: [mockMember],
      };

      mockRepo.find.mockResolvedValue([mockRoutine]);

      await (service as any).processCollaborativePenalties(yesterdayStr);

      expect(mockRoutine.lives).toBe(2);
      expect(mockXpLogsService.deductXP).toHaveBeenCalledWith('u-1', 10, 'COLLAB_ROUTINE_MISSED');
    });
  });
});
