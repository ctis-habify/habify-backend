import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CollaborativeRoutineInvitationsService } from './routine-invitations.service';
import { SendCollaborativeRoutineInvitationDto } from '../common/dto/routine-invitations/send-routine-invitation.dto';
import { CollaborativeRoutineInvitationResponseDto } from '../common/dto/routine-invitations/routine-invitation-response.dto';

@ApiTags('routine-invitations')
@ApiBearerAuth('access-token')
@Controller('routine-invitations')
export class CollaborativeRoutineInvitationsController {
  constructor(private readonly invitationsService: CollaborativeRoutineInvitationsService) {}

  @UseGuards(AuthGuard)
  @Post()
  async sendInvitation(
    @Req() req: Request,
    @Body() dto: SendCollaborativeRoutineInvitationDto,
  ): Promise<CollaborativeRoutineInvitationResponseDto> {
    const userId = req.user.id;
    const invitation = await this.invitationsService.sendInvitation(userId, dto);
    // Re-fetch with relations so the response includes names
    const received = await this.invitationsService.getSentInvitations(userId);
    return received.find((i) => i.id === invitation.id)!;
  }

  @UseGuards(AuthGuard)
  @Get('received')
  async getReceivedInvitations(@Req() req: Request): Promise<CollaborativeRoutineInvitationResponseDto[]> {
    const userId = req.user.id;
    return this.invitationsService.getReceivedInvitations(userId);
  }

  @UseGuards(AuthGuard)
  @Get('sent')
  async getSentInvitations(@Req() req: Request): Promise<CollaborativeRoutineInvitationResponseDto[]> {
    const userId = req.user.id;
    return this.invitationsService.getSentInvitations(userId);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/accept')
  async acceptInvitation(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<CollaborativeRoutineInvitationResponseDto> {
    const userId = req.user.id;
    return this.invitationsService.acceptInvitation(id, userId);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/decline')
  async declineInvitation(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const userId = req.user.id;
    return this.invitationsService.declineInvitation(id, userId);
  }
}
