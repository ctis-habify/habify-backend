import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoutineInvitationsService } from './routine-invitations.service';
import { RoutineInvitation } from './routine-invitations.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { RoutineMember } from '../routines/routine-members.entity';
import { FriendRequestsService } from '../friend-requests/friend-requests.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('RoutineInvitationsService (Unit)', () => {
  let service: RoutineInvitationsService;

  const mockInvitationRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    find: jest.fn(),
  };

  const mockRoutineRepo = {
    findOne: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
  };

  const mockFriendRequestsService = {
    getFriends: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockNotificationsService = {
    createAndPush: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutineInvitationsService,
        { provide: getRepositoryToken(RoutineInvitation), useValue: mockInvitationRepo },
        { provide: getRepositoryToken(CollaborativeRoutine), useValue: mockRoutineRepo },
        { provide: getRepositoryToken(RoutineMember), useValue: mockMemberRepo },
        { provide: FriendRequestsService, useValue: mockFriendRequestsService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<RoutineInvitationsService>(RoutineInvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendInvitation', () => {
    it('should throw NotFoundException if routine not found', async () => {
      mockRoutineRepo.findOne.mockResolvedValue(null);
      await expect(
        service.sendInvitation('u-1', { routineId: 'r-1', toUserId: 'u-2' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if sender is not a member', async () => {
      mockRoutineRepo.findOne.mockResolvedValue({ id: 'r-1' });
      mockMemberRepo.findOne.mockResolvedValue(null);
      await expect(
        service.sendInvitation('u-1', { routineId: 'r-1', toUserId: 'u-2' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if invitee is not a friend', async () => {
      mockRoutineRepo.findOne.mockResolvedValue({ id: 'r-1' });
      mockMemberRepo.findOne.mockResolvedValue({ id: 'm-1' });
      mockFriendRequestsService.getFriends.mockResolvedValue([]); // No friends

      await expect(
        service.sendInvitation('u-1', { routineId: 'r-1', toUserId: 'u-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create and send invitation', async () => {
      mockRoutineRepo.findOne.mockResolvedValue({ id: 'r-1', routineName: 'G1' });
      mockMemberRepo.findOne.mockResolvedValueOnce({ id: 'm-1' }); // sender membership
      mockMemberRepo.findOne.mockResolvedValueOnce(null); // invitee not member
      mockFriendRequestsService.getFriends.mockResolvedValue([{ id: 'u-2' }]);
      mockInvitationRepo.findOne.mockResolvedValue(null); // no duplicate pending
      mockInvitationRepo.save.mockResolvedValue({ id: 'inv-1' });

      const result = await service.sendInvitation('u-1', { routineId: 'r-1', toUserId: 'u-2' });

      expect(result.id).toBe('inv-1');
      expect(mockInvitationRepo.save).toHaveBeenCalled();
      expect(mockNotificationsService.createAndPush).toHaveBeenCalled();
    });
  });
});
