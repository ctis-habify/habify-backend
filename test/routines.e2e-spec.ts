import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoutinesController } from '../src/routines/routines.controller';
import { RoutinesService } from '../src/routines/routines.service';
import { Routine } from '../src/routines/routines.entity';
import { RoutineList } from '../src/routine-lists/routine-lists.entity';
import { RoutineLog } from '../src/routine-logs/routine-logs.entity';
import { Category } from '../src/categories/categories.entity';
import { RoutineMember } from '../src/routines/routine-members.entity';
import { CollaborativeRoutine } from '../src/routines/collaborative-routines.entity';
import { AuthGuard } from '../src/auth/auth.guard';
import { AiService } from '../src/ai/ai.service';
import { GcsService } from '../src/storage/gcs.service';
import { XpLogsService } from '../src/xp-logs/xp-logs.service';
import { RoutineLogsService } from '../src/routine-logs/routine-logs.service';
import { UsersService } from '../src/users/users.service';
import { CollaborativeRoutineLogsService } from '../src/routines/collaborative-routine-logs.service';

// Mock AiService to avoid loading @xenova/transformers (ESM issue)
jest.mock('../src/ai/ai.service', () => ({
  AiService: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}));

describe('Routines E2E', () => {
  let app: INestApplication;
  let routinesService: RoutinesService;

  // Mock Repositories
  const mockRoutineRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((routine) => Promise.resolve({ id: 'routine-uuid', ...routine })),
    delete: jest.fn(),
  };
  const mockCollaborativeRoutineRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((routine) => Promise.resolve({ id: 'collab-uuid', ...routine })),
  };

  const mockRoutineListRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRoutineLogRepo = {};
  const mockCategoryRepo = {
    findOne: jest.fn(),
  };
  const mockMemberRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((member) => Promise.resolve({ id: 'member-uuid', ...member })),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  // Mock Other Services
  const mockAiService = {};
  const mockGcsService = {};
  const mockXpLogsService = {};
  const mockRoutineLogsService = {};
  const mockUsersService = {
    findById: jest.fn(),
  };
  const mockCollaborativeLogsService = {
    create: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RoutinesController],
      providers: [
        RoutinesService,
        { provide: getRepositoryToken(Routine), useValue: mockRoutineRepo },
        { provide: getRepositoryToken(CollaborativeRoutine), useValue: mockCollaborativeRoutineRepo },
        { provide: getRepositoryToken(RoutineList), useValue: mockRoutineListRepo },
        { provide: getRepositoryToken(RoutineLog), useValue: mockRoutineLogRepo },
        { provide: getRepositoryToken(Category), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(RoutineMember), useValue: mockMemberRepo },
        { provide: AiService, useValue: mockAiService },
        { provide: GcsService, useValue: mockGcsService },
        { provide: XpLogsService, useValue: mockXpLogsService },
        { provide: RoutineLogsService, useValue: mockRoutineLogsService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CollaborativeRoutineLogsService, useValue: mockCollaborativeLogsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'user-1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    routinesService = moduleFixture.get<RoutinesService>(RoutinesService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /routines/collaborative -> should create a routine with collaborativeKey', async () => {
    const createDto = {
      routineListId: 1,
      routineName: 'Collaborative Run',
      frequencyType: 'Daily',
      startTime: '07:00:00',
      endTime: '08:00:00',
      startDate: '2023-11-01',
      isAiVerified: false,
      routineType: 'collaborative',
      description: 'Test Description',
      lives: 3,
      isPublic: true,
      rewardCondition: 'Badge',
      ageRequirement: 18,
      genderRequirement: 'male',
      xpRequirement: 100,
      completionXp: 20,
    };

    const res = await request(app.getHttpServer())
      .post('/routines/collaborative')
      .send(createDto)
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.routineName).toBe('Collaborative Run');
    expect(res.body.collaborativeKey).toBeDefined();
    expect(typeof res.body.collaborativeKey).toBe('string');
    expect(res.body.collaborativeKey).toHaveLength(8); // 4 bytes hex = 8 chars
    expect(res.body.creatorId).toBe('user-1');

    // Verify Repository called correctly
    expect(mockCollaborativeRoutineRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Test Description',
      lives: 3,
      isPublic: true,
      rewardCondition: 'Badge',
      ageRequirement: 18,
      genderRequirement: 'male',
      xpRequirement: 100,
      completionXp: 20,
    }));
  });
  it('POST /routines/collaborative -> should create a routine with categoryId (auto-create list)', async () => {
    const createDto = {
      categoryId: 1, // Using categoryId instead of routineListId
      routineName: 'Category Based Routine',
      frequencyType: 'Daily',
      startTime: '09:00:00',
      endTime: '10:00:00',
      startDate: '2023-11-01',
      isAiVerified: false,
      routineType: 'collaborative',
      description: 'Test Description',
    };

    // Mock RoutineListRepo (no longer used for collab)
    mockRoutineListRepo.findOne = jest.fn();

    // Mock CategoryRepo to return a valid category
    mockCategoryRepo.findOne = jest.fn().mockResolvedValue({ id: 1, name: 'Health', type: 'collaborative' });

    const res = await request(app.getHttpServer())
      .post('/routines/collaborative')
      .send(createDto)
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.routineName).toBe('Category Based Routine');
    
    // Verify membership was created for the creator
    expect(mockMemberRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      role: 'creator',
    }));
  });

  describe('POST /routines/join', () => {
    const routineKey = 'ABCDEF12';
    const mockRoutine = {
      id: 'routine-uuid',
      collaborativeKey: routineKey,
      ageRequirement: 18,
      genderRequirement: 'female',
      xpRequirement: 100,
    };

    beforeEach(() => {
      mockCollaborativeRoutineRepo.findOne = jest.fn().mockResolvedValue(mockRoutine);
      mockMemberRepo.findOne = jest.fn().mockResolvedValue(null);
    });

    it('should fail if user does not meet age requirement', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user-1',
        birthDate: new Date('2015-01-01'), // ~9 years old
        gender: 'female',
        totalXp: 200,
      });

      const res = await request(app.getHttpServer())
        .post('/routines/join')
        .send({ key: routineKey })
        .expect(400);

      expect(res.body.message).toContain('You must be at least 18 years old');
    });

    it('should fail if user does not meet gender requirement', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user-1',
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        totalXp: 200,
      });

      const res = await request(app.getHttpServer())
        .post('/routines/join')
        .send({ key: routineKey })
        .expect(400);

      expect(res.body.message).toContain('This routine is only for female members');
    });

    it('should fail if user does not meet XP requirement', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user-1',
        birthDate: new Date('1990-01-01'),
        gender: 'female',
        totalXp: 50,
      });

      const res = await request(app.getHttpServer())
        .post('/routines/join')
        .send({ key: routineKey })
        .expect(400);

      expect(res.body.message).toContain('You need at least 100 XP');
    });

    it('should join successfully if all requirements are met', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user-1',
        birthDate: new Date('1990-01-01'),
        gender: 'female',
        totalXp: 150,
      });

      const res = await request(app.getHttpServer())
        .post('/routines/join')
        .send({ key: routineKey })
        .expect(201);

      expect(res.body.message).toBe('Joined collaborative routine successfully');
    });
  });
});
