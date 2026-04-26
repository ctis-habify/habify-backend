import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { XpLogsService } from './xp-logs.service';
import { XpLog } from './xp-logs.entity';
import { User } from '../users/users.entity';

describe('XpLogsService (Unit)', () => {
  let service: XpLogsService;

  const mockXpLogRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto })),
    find: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XpLogsService,
        { provide: getRepositoryToken(XpLog), useValue: mockXpLogRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<XpLogsService>(XpLogsService);
  });

  it('awardXP should save a new log', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'u-1', totalXp: 100 });
    const result = await service.awardXP('u-1', 50, 'DAILY_STREAK');
    expect(mockXpLogRepo.save).toHaveBeenCalled();
    expect(result!.amount).toBe(50);
  });
});
