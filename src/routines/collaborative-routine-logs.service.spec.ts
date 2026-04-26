import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollaborativeRoutineLogsService } from './collaborative-routine-logs.service';
import { CollaborativeRoutineLog } from './collaborative-routine-logs.entity';
import { CollaborativeRoutine } from './collaborative-routines.entity';
import { RoutineMember } from './routine-members.entity';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { GcsService } from '../storage/gcs.service';
import { AiService } from '../ai/ai.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CollaborativeScoreService } from '../collaborative-score/collaborative-score.service';
import { CollaborativeChatService } from './collaborative-chat.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CollaborativeRoutineLogsService (Unit)', () => {
  let service: CollaborativeRoutineLogsService;

  const mockLogsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };

  const mockRoutinesRepo = {
    findOne: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
  };

  const mockXpLogsService = {
    awardXP: jest.fn(),
  };

  const mockGcsService = {
    getSignedReadUrl: jest.fn(),
  };

  const mockAiService = {
    verify: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockNotificationsService = {
    createAndPush: jest.fn(),
  };

  const mockCollabScoreService = {
    addPoints: jest.fn(),
  };

  const mockCollabChatService = {
    sendSystemMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborativeRoutineLogsService,
        { provide: getRepositoryToken(CollaborativeRoutineLog), useValue: mockLogsRepo },
        { provide: getRepositoryToken(CollaborativeRoutine), useValue: mockRoutinesRepo },
        { provide: getRepositoryToken(RoutineMember), useValue: mockMemberRepo },
        { provide: XpLogsService, useValue: mockXpLogsService },
        { provide: GcsService, useValue: mockGcsService },
        { provide: AiService, useValue: mockAiService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: CollaborativeScoreService, useValue: mockCollabScoreService },
        { provide: CollaborativeChatService, useValue: mockCollabChatService },
      ],
    }).compile();

    service = module.get<CollaborativeRoutineLogsService>(CollaborativeRoutineLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyLog', () => {
    it('should throw NotFoundException if log does not exist', async () => {
      mockLogsRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyLog('u-1', 1, 'approved')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a member of the group', async () => {
      mockLogsRepo.findOne.mockResolvedValue({
        id: 1,
        status: 'pending',
        userId: 'submitter-id',
        routine: { id: 'r-1' },
        approvals: [],
        rejections: [],
      });
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyLog('outsider-id', 1, 'approved')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should successfully add an approval and not finalize if threshold not met', async () => {
      const mockLog = {
        id: 1,
        status: 'pending',
        userId: 'user-A',
        routine: {
          id: 'r-1',
          members: [{ userId: 'user-A' }, { userId: 'user-B' }, { userId: 'user-C' }],
        },
        approvals: [],
        rejections: [],
        requiredApprovals: 2,
      };
      mockLogsRepo.findOne.mockResolvedValue(mockLog);
      mockMemberRepo.findOne.mockResolvedValue({ userId: 'user-B' });

      const result = await service.verifyLog('user-B', 1, 'approved');

      expect(mockLog.approvals).toContain('user-B');
      expect(mockLog.status).toBe('pending'); // Still pending because 1/2 approvals
      expect(mockLogsRepo.save).toHaveBeenCalled();
      expect(result.message).toBe('Log approved successfully');
    });

    it('should finalize log and award XP when threshold is met', async () => {
      const mockLog = {
        id: 1,
        status: 'pending',
        userId: 'user-A',
        routine: {
          id: 'r-1',
          completionXp: 20,
          frequencyType: 'daily',
          startDate: '2020-01-01',
          members: [{ userId: 'user-A' }, { userId: 'user-B' }],
        },
        approvals: [],
        isVerified: false,
        requiredApprovals: 1,
      };
      mockLogsRepo.findOne.mockResolvedValue(mockLog);
      mockMemberRepo.findOne.mockResolvedValue({ userId: 'user-B' });
      mockMemberRepo.findOne.mockImplementation((query) => {
        if (query.where.userId === 'user-A')
          return Promise.resolve({ userId: 'user-A', streak: 1, lastCompletedDate: '2020-01-01' });
        return Promise.resolve({ userId: 'user-B' });
      });

      const result = await service.verifyLog('user-B', 1, 'approved');

      expect(mockLog.status).toBe('approved');
      expect(mockLog.isVerified).toBe(true);
      expect(mockXpLogsService.awardXP).toHaveBeenCalledWith('user-A', 20, 'COLLABORATIVE');
      expect(mockCollabScoreService.addPoints).toHaveBeenCalledWith('user-A', 20);
      expect(result.isCompletedByGroup).toBe(true);
    });
  });
});
