import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';

import { VerificationService } from './verification.service';
import { Verification } from './verification.entity';
import { Routine } from '../routines/routines.entity';

import { AiService } from '../ai/ai.service';
import { GcsService } from '../storage/gcs.service';
import { RoutineLogsService } from '../routine_logs/routine_logs.service';

describe('VerificationService (unit)', () => {
  let service: VerificationService;
  const aiMock = {
    verify: jest.fn(),
  };

  const gcsMock = {
    getSignedReadUrl: jest.fn(),
  };

  const verificationRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const routineRepoMock = {
    findOne: jest.fn(),
  };

  const routineLogsMock = {
    create: jest.fn(),
  };

  const queueMock = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,

        { provide: AiService, useValue: aiMock },
        { provide: GcsService, useValue: gcsMock },
        { provide: RoutineLogsService, useValue: routineLogsMock },

        { provide: getRepositoryToken(Verification), useValue: verificationRepoMock },
        { provide: getRepositoryToken(Routine), useValue: routineRepoMock },

        { provide: getQueueToken('verification'), useValue: queueMock },
      ],
    }).compile();

    service = module.get(VerificationService);

    jest.clearAllMocks();
  });

  it('process → AI verify çağrılır ve log oluşturulur', async () => {
    verificationRepoMock.findOne.mockResolvedValue({
      id: 'ver-1',
      userId: 'user-1',
      verificationImageUrl: 'verifications/user-1/test.jpg',
      routine: {
        id: 1,
        routine_name: 'Drink water',
      },
    });

    gcsMock.getSignedReadUrl.mockResolvedValue('https://signed-read-url');

    aiMock.verify.mockResolvedValue({
      verified: true,
      score: 0.42,
    });

    verificationRepoMock.save.mockImplementation(async x => x);

    await service.process({
      data: { verificationId: 'ver-1' },
      attemptsMade: 0,
      opts: { attempts: 1 },
    } as any);

    // ---- THEN ----
    expect(gcsMock.getSignedReadUrl).toHaveBeenCalled();
    expect(aiMock.verify).toHaveBeenCalled();
    expect(routineLogsMock.create).toHaveBeenCalled();
  });
});
