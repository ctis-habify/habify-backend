import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollaborativeScoreService } from './collaborative-score.service';
import { CollaborativeScore } from './collaborative-score.entity';
import { CollaborativeRoutineMember } from '../routines/routine-members.entity';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';
import { XpLog } from '../xp-logs/xp-logs.entity';

describe('CollaborativeScoreService (Unit)', () => {
  let service: CollaborativeScoreService;

  const mockScoreRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCollabLogRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockXpLogRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborativeScoreService,
        { provide: getRepositoryToken(CollaborativeScore), useValue: mockScoreRepo },
        { provide: getRepositoryToken(CollaborativeRoutineMember), useValue: mockMemberRepo },
        { provide: getRepositoryToken(CollaborativeRoutineLog), useValue: mockCollabLogRepo },
        { provide: getRepositoryToken(XpLog), useValue: mockXpLogRepo },
      ],
    }).compile();

    service = module.get<CollaborativeScoreService>(CollaborativeScoreService);
  });

  describe('syncUserScore', () => {
    it('should sum xp logs and update score', async () => {
      const userId = 'u-1';
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '150' }),
      };
      mockXpLogRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockScore = { userId, totalPoints: 0 };
      mockScoreRepo.findOne.mockResolvedValue(mockScore);
      mockScoreRepo.save.mockImplementation((s) => Promise.resolve(s));

      const result = await service.syncUserScore(userId);

      expect(result.totalPoints).toBe(150);
      expect(mockScoreRepo.save).toHaveBeenCalled();
    });
  });
});
