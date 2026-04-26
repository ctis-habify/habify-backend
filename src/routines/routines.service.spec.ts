import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoutinesService } from './routines.service';
import { Routine } from './routines.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineList } from '../routine-lists/routine-lists.entity';
import { Category } from '../categories/categories.entity';
import { RoutineMember } from './routine-members.entity';
import { User } from '../users/users.entity';
import { RoutineLog } from '../routine-logs/routine-logs.entity';
import { UsersService } from '../users/users.service';
import { CollaborativeScoreService } from '../collaborative-score/collaborative-score.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('RoutinesService (Unit)', () => {
  let service: RoutinesService;

  const mockRoutineRepo = {
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  };

  const mockCollabRoutineRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockRoutineListRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockLogRepo = {
    find: jest.fn(),
  };

  const mockMemberRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockCategoryRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockCollabScoreService = {
    addPoints: jest.fn(),
  };

  const mockAuditLogsService = {
    createLog: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinesService,
        { provide: getRepositoryToken(Routine), useValue: mockRoutineRepo },
        { provide: getRepositoryToken(CollaborativeRoutine), useValue: mockCollabRoutineRepo },
        { provide: getRepositoryToken(RoutineList), useValue: mockRoutineListRepo },
        { provide: getRepositoryToken(Category), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(RoutineMember), useValue: mockMemberRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RoutineLog), useValue: mockLogRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CollaborativeScoreService, useValue: mockCollabScoreService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
      ],
    }).compile();

    service = module.get<RoutinesService>(RoutinesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('browsePublicRoutines', () => {
    it('should order routines by createdAt DESC', async () => {
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: '1', routineName: 'R1', createdAt: new Date('2024-01-20'), members: [] },
          { id: '2', routineName: 'R2', createdAt: new Date('2024-01-15'), members: [] },
        ]),
      };

      mockCollabRoutineRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.browsePublicRoutines('user-1');

      expect(mockCollabRoutineRepo.createQueryBuilder).toHaveBeenCalledWith('routine');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('routine.createdAt', 'DESC');
    });
  });

  describe('syncStreak', () => {
    it('should reset isAiVerified if it is completed in previous cycle but not current', async () => {
      const routine = {
        id: 'r-1',
        routineName: 'Test',
        frequencyType: 'daily',
        startDate: '2024-01-01',
        lastCompletedDate: '2024-01-10',
        isAiVerified: true,
        streak: 5,
      } as Routine;

      const todayStr = '2024-01-12'; // Two days later, streak broken and AiVerified should reset

      await (service as any).syncStreak(routine, todayStr);

      expect(routine.isAiVerified).toBe(false);
      expect(mockRoutineRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r-1', isAiVerified: false }),
      );
    });
  });
});
