import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { FriendRequestsService } from './friend-requests.service';
import { SendFriendRequestDto } from '../common/dto/friend-requests/send-friend-request.dto';
import { FriendRequest } from './friend-requests.entity';
import { UserSearchResultDto } from '../common/dto/users/user-search-result.dto';

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

  @UseGuards(AuthGuard)
  @Get('friends')
  async getFriends(@Req() req: Request): Promise<UserSearchResultDto[]> {
    const userId = (req.user as any).id;
    return this.friendRequestsService.getFriends(userId);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/accept')
  async acceptRequest(@Req() req: Request, @Param('id') id: string): Promise<FriendRequest> {
    const userId = (req.user as any).id;
    return this.friendRequestsService.acceptRequest(id, userId);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/decline')
  async declineRequest(@Req() req: Request, @Param('id') id: string): Promise<{ message: string }> {
    const userId = (req.user as any).id;
    await this.friendRequestsService.declineRequest(id, userId);
    return { message: 'Request declined' };
  }
}
