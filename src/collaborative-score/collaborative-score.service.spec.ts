import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollaborativeScoreService } from './collaborative-score.service';
import { CollaborativeScore } from './collaborative-score.entity';
import { CollaborativeRoutineMember } from '../routines/routine-members.entity';
import { CollaborativeRoutineLog } from '../routines/collaborative-routine-logs.entity';

describe('CollaborativeScoreService (Unit)', () => {
  let service: CollaborativeScoreService;

  const mockScoreRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  const mockCollabLogRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborativeScoreService,
        { provide: getRepositoryToken(CollaborativeScore), useValue: mockScoreRepo },
        { provide: getRepositoryToken(CollaborativeRoutineMember), useValue: mockMemberRepo },
        { provide: getRepositoryToken(CollaborativeRoutineLog), useValue: mockCollabLogRepo },
      ],
    }).compile();

    service = module.get<CollaborativeScoreService>(CollaborativeScoreService);
  });

  describe('addPoints', () => {
    it('should update points', async () => {
      const mockScore = { userId: 'u-1', totalPoints: 40 };
      mockScoreRepo.findOne.mockResolvedValue(mockScore);

      await service.addPoints('u-1', 70);

      expect(mockScore.totalPoints).toBe(110);
      expect(mockScoreRepo.save).toHaveBeenCalled();
    });
  });
});
