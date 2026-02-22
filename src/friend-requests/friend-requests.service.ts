import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendRequest, FriendRequestStatus } from './friend-requests.entity';
import { UsersService } from '../users/users.service';
import { SendFriendRequestDto } from '../common/dto/friend-requests/send-friend-request.dto';
import { User } from '../users/users.entity';
import { UserSearchResultDto } from '../common/dto/users/user-search-result.dto';

@Injectable()
export class FriendRequestsService {
  constructor(
    @InjectRepository(FriendRequest)
    private readonly repo: Repository<FriendRequest>,
    private readonly usersService: UsersService,
  ) {}

  async sendRequest(fromUserId: string, dto: SendFriendRequestDto): Promise<FriendRequest> {
    const { toUserId } = dto;
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const toUser = await this.usersService.findById(toUserId);
    if (!toUser) throw new BadRequestException('User not found');

    const existing = await this.repo
      .createQueryBuilder('fr')
      .where(
        '((fr.from_user_id = :from AND fr.to_user_id = :to) OR (fr.from_user_id = :to AND fr.to_user_id = :from))',
        { from: fromUserId, to: toUserId },
      )
      .andWhere('fr.status IN (:...statuses)', {
        statuses: [FriendRequestStatus.pending, FriendRequestStatus.accepted],
      })
      .getOne();

    if (existing) {
      if (existing.status === FriendRequestStatus.accepted) {
        throw new ConflictException('Already friends');
      }
      throw new ConflictException('Friend request already sent or pending');
    }

    const request = this.repo.create({
      fromUserId,
      toUserId,
      status: FriendRequestStatus.pending,
    });
    return this.repo.save(request);
  }

  async getSentRequests(userId: string): Promise<FriendRequest[]> {
    return this.repo.find({
      where: { fromUserId: userId, status: FriendRequestStatus.pending },
      order: { createdAt: 'DESC' },
      relations: ['toUser'],
    });
  }

  async getReceivedRequests(userId: string): Promise<FriendRequest[]> {
    return this.repo.find({
      where: { toUserId: userId, status: FriendRequestStatus.pending },
      order: { createdAt: 'DESC' },
      relations: ['fromUser'],
    });
  }

  async acceptRequest(requestId: string, userId: string): Promise<FriendRequest> {
    const request = await this.repo.findOne({
      where: { id: requestId },
      relations: ['fromUser', 'toUser'],
    });
    if (!request) throw new NotFoundException('Friend request not found');
    if (request.toUserId !== userId)
      throw new BadRequestException('You can only accept requests sent to you');
    if (request.status !== FriendRequestStatus.pending)
      throw new BadRequestException('Request is no longer pending');
    request.status = FriendRequestStatus.accepted;
    return this.repo.save(request);
  }

  async declineRequest(requestId: string, userId: string): Promise<void> {
    const request = await this.repo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Friend request not found');
    if (request.toUserId !== userId)
      throw new BadRequestException('You can only decline requests sent to you');
    if (request.status !== FriendRequestStatus.pending)
      throw new BadRequestException('Request is no longer pending');
    request.status = FriendRequestStatus.declined;
    await this.repo.save(request);
  }

  /** Returns users who are friends (accepted request in either direction). */
  async getFriends(userId: string): Promise<UserSearchResultDto[]> {
    const accepted = await this.repo.find({
      where: { status: FriendRequestStatus.accepted },
      relations: ['fromUser', 'toUser'],
    });
    const friendIds = new Set<string>();
    for (const fr of accepted) {
      if (fr.fromUserId === userId) friendIds.add(fr.toUserId);
      else if (fr.toUserId === userId) friendIds.add(fr.fromUserId);
    }
    if (friendIds.size === 0) return [];
    const users = await this.repo.manager
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: Array.from(friendIds) })
      .getMany();
    return users.map((u) => {
      const dto = new UserSearchResultDto();
      dto.id = u.id;
      dto.name = u.name;
      dto.username = u.username;
      dto.avatarUrl = u.avatarUrl;
      dto.totalXp = u.totalXp;
      return dto;
    });
  }
}
