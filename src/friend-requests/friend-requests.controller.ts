import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { FriendRequestsService } from './friend-requests.service';
import { SendFriendRequestDto } from '../common/dto/friend-requests/send-friend-request.dto';
import { FriendRequest } from './friend-requests.entity';

@ApiTags('friend-requests')
@ApiBearerAuth('access-token')
@Controller('friend-requests')
export class FriendRequestsController {
  constructor(private readonly friendRequestsService: FriendRequestsService) {}

  @UseGuards(AuthGuard)
  @Post()
  async sendRequest(
    @Req() req: Request,
    @Body() dto: SendFriendRequestDto,
  ): Promise<FriendRequest> {
    const userId = (req.user as any).id;
    return this.friendRequestsService.sendRequest(userId, dto);
  }

  @UseGuards(AuthGuard)
  @Get('sent')
  async getSentRequests(@Req() req: Request): Promise<FriendRequest[]> {
    const userId = (req.user as any).id;
    return this.friendRequestsService.getSentRequests(userId);
  }

  @UseGuards(AuthGuard)
  @Get('received')
  async getReceivedRequests(@Req() req: Request): Promise<FriendRequest[]> {
    const userId = (req.user as any).id;
    return this.friendRequestsService.getReceivedRequests(userId);
  }
}
