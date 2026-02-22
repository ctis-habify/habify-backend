import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendRequest, FriendRequestStatus } from './friend-requests.entity';
import { UsersService } from '../users/users.service';
import { SendFriendRequestDto } from '../common/dto/friend-requests/send-friend-request.dto';

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
      where: { fromUserId: userId },
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
}
