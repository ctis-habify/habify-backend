import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineInvitation, RoutineInvitationStatus } from './routine-invitations.entity';
import { CollaborativeRoutine } from '../routines/collaborative-routines.entity';
import { RoutineMember } from '../routines/routine-members.entity';
import { FriendRequestsService } from '../friend-requests/friend-requests.service';
import { UsersService } from '../users/users.service';
import { SendRoutineInvitationDto } from '../common/dto/routine-invitations/send-routine-invitation.dto';
import { RoutineInvitationResponseDto } from '../common/dto/routine-invitations/routine-invitation-response.dto';

@Injectable()
export class RoutineInvitationsService {
  constructor(
    @InjectRepository(RoutineInvitation)
    private readonly invitationRepo: Repository<RoutineInvitation>,

    @InjectRepository(CollaborativeRoutine)
    private readonly routineRepo: Repository<CollaborativeRoutine>,

    @InjectRepository(RoutineMember)
    private readonly memberRepo: Repository<RoutineMember>,

    private readonly friendRequestsService: FriendRequestsService,
    private readonly usersService: UsersService,
  ) {}

  async sendInvitation(
    fromUserId: string,
    dto: SendRoutineInvitationDto,
  ): Promise<RoutineInvitation> {
    const { routineId, toUserId } = dto;

    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot invite yourself');
    }

    // 1. Verify the routine exists
    const routine = await this.routineRepo.findOne({ where: { id: routineId } });
    if (!routine) {
      throw new NotFoundException('Collaborative routine not found');
    }

    // 2. Verify the inviter is a member of the routine
    const inviterMembership = await this.memberRepo.findOne({
      where: { collaborativeRoutineId: routineId, userId: fromUserId },
    });
    if (!inviterMembership) {
      throw new ForbiddenException('You are not a member of this routine');
    }

    // 3. Verify the invitee is a friend
    const friends = await this.friendRequestsService.getFriends(fromUserId);
    const isFriend = friends.some((f) => f.id === toUserId);
    if (!isFriend) {
      throw new BadRequestException('You can only invite friends');
    }

    // 4. Check if already a member
    const existingMember = await this.memberRepo.findOne({
      where: { collaborativeRoutineId: routineId, userId: toUserId },
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this routine');
    }

    // 5. Check for duplicate pending invitation
    const existingInvitation = await this.invitationRepo.findOne({
      where: {
        routineId,
        toUserId,
        status: RoutineInvitationStatus.pending,
      },
    });
    if (existingInvitation) {
      throw new ConflictException('An invitation is already pending for this user');
    }

    // 6. Create the invitation
    const invitation = this.invitationRepo.create({
      routineId,
      fromUserId,
      toUserId,
      status: RoutineInvitationStatus.pending,
    });

    return this.invitationRepo.save(invitation);
  }

  async getReceivedInvitations(userId: string): Promise<RoutineInvitationResponseDto[]> {
    const invitations = await this.invitationRepo.find({
      where: { toUserId: userId, status: RoutineInvitationStatus.pending },
      relations: ['routine', 'fromUser', 'toUser'],
      order: { createdAt: 'DESC' },
    });

    return invitations.map((inv) => this.toResponseDto(inv));
  }

  async getSentInvitations(userId: string): Promise<RoutineInvitationResponseDto[]> {
    const invitations = await this.invitationRepo.find({
      where: { fromUserId: userId },
      relations: ['routine', 'fromUser', 'toUser'],
      order: { createdAt: 'DESC' },
    });

    return invitations.map((inv) => this.toResponseDto(inv));
  }

  async acceptInvitation(
    invitationId: string,
    userId: string,
  ): Promise<RoutineInvitationResponseDto> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
      relations: ['routine', 'fromUser', 'toUser'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.toUserId !== userId) {
      throw new ForbiddenException('You can only accept invitations sent to you');
    }
    if (invitation.status !== RoutineInvitationStatus.pending) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    // Check if already a member (might have joined via key in the meantime)
    const existingMember = await this.memberRepo.findOne({
      where: { collaborativeRoutineId: invitation.routineId, userId },
    });

    if (!existingMember) {
      // Create membership
      const membership = this.memberRepo.create({
        collaborativeRoutineId: invitation.routineId,
        userId,
        role: 'member',
        streak: 0,
        missedCount: 0,
      });
      await this.memberRepo.save(membership);
    }

    invitation.status = RoutineInvitationStatus.accepted;
    const saved = await this.invitationRepo.save(invitation);

    return this.toResponseDto(saved);
  }

  async declineInvitation(invitationId: string, userId: string): Promise<{ message: string }> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.toUserId !== userId) {
      throw new ForbiddenException('You can only decline invitations sent to you');
    }
    if (invitation.status !== RoutineInvitationStatus.pending) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    invitation.status = RoutineInvitationStatus.declined;
    await this.invitationRepo.save(invitation);

    return { message: 'Invitation declined' };
  }

  private toResponseDto(inv: RoutineInvitation): RoutineInvitationResponseDto {
    const dto = new RoutineInvitationResponseDto();
    dto.id = inv.id;
    dto.routineId = inv.routineId;
    dto.routineName = inv.routine?.routineName ?? '';
    dto.fromUserId = inv.fromUserId;
    dto.fromUserName = inv.fromUser?.name ?? '';
    dto.fromUserAvatarUrl = inv.fromUser?.avatarUrl ?? null;
    dto.toUserId = inv.toUserId;
    dto.toUserName = inv.toUser?.name ?? '';
    dto.toUserAvatarUrl = inv.toUser?.avatarUrl ?? null;
    dto.status = inv.status;
    dto.createdAt = inv.createdAt;
    return dto;
  }
}
