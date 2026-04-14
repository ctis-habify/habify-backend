import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CollaborativeChatService } from './collaborative-chat.service';
import { AuthGuard } from '../auth/auth.guard';
import type { Request } from 'express';
import { CollaborativeChatMessage } from './collaborative-chat-message.entity';
import type { PredefinedChatMessageItem } from './predefined-chat-messages';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@ApiTags('routines')
@ApiBearerAuth('access-token')
@Controller('routines/collaborative-chat')
export class CollaborativeChatController {
  constructor(private readonly chatService: CollaborativeChatService) {}

  @UseGuards(AuthGuard)
  @Get('predefined')
  getPredefinedMessages(): PredefinedChatMessageItem[] {
    return this.chatService.getPredefinedMessages();
  }

  @UseGuards(AuthGuard)
  @Get(':routineId')
  async getMessages(@Param('routineId') routineId: string): Promise<CollaborativeChatMessage[]> {
    return this.chatService.getMessages(routineId);
  }

  @UseGuards(AuthGuard)
  @Post(':routineId')
  async sendMessage(
    @Param('routineId') routineId: string,
    @Req() req: AuthenticatedRequest,
    @Body('message') message: string,
  ): Promise<CollaborativeChatMessage> {
    const userId = req.user.id;
    return this.chatService.sendMessage(routineId, userId, message);
  }
}
