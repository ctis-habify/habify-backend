import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { DataSource } from 'typeorm';
import { RoutinePenaltyService } from '../routines/routine-penalty.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { XpLogsService } from '../xp-logs/xp-logs.service';
import { CollaborativeScoreService } from '../collaborative-score/collaborative-score.service';
import { CollaborativeRoutineLogsService } from '../routines/collaborative-routine-logs.service';

describe('SchedulerService (Unit)', () => {
  let service: SchedulerService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockRoutinePenaltyService = {
    checkAndApplyPenalties: jest.fn(),
  };

  const mockAuditLogsService = {
    log: jest.fn(),
  };

  const mockNotificationsService = {
    createAndPush: jest.fn(),
  };

  const mockCollabLogsService = {
    getApprovedLogCountMapByRoutine: jest.fn(),
  };

  const mockXpLogsService = {
    awardXP: jest.fn(),
  };

  const mockCollabScoreService = {
    addPoints: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: RoutinePenaltyService, useValue: mockRoutinePenaltyService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: CollaborativeRoutineLogsService, useValue: mockCollabLogsService },
        { provide: XpLogsService, useValue: mockXpLogsService },
        { provide: CollaborativeScoreService, useValue: mockCollabScoreService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should identify winners and award points', async () => {
    mockDataSource.query.mockResolvedValueOnce([{ id: 'r-1', routineName: 'G1' }]); // routines
    mockDataSource.query.mockResolvedValueOnce([{ userId: 'u-1' }]); // winners
    mockDataSource.query.mockResolvedValueOnce([{ userId: 'u-2' }]); // others
    mockCollabLogsService.getApprovedLogCountMapByRoutine.mockResolvedValue({ ['u-1']: 5 });

    await service.checkAndRewardConcludedRoutines();

    expect(mockXpLogsService.awardXP).toHaveBeenCalled();
  });
});
