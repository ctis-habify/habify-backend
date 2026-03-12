import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from './notifications.service';
import { RegisterPushTokenDto } from '../common/dto/notifications/register-push-token.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated notifications for the current user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getNotifications(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = (req.user as JwtPayload).id;
    return this.notificationsService.getUserNotifications(
      userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get number of unread notifications' })
  async getUnreadCount(@Req() req: Request) {
    const userId = (req.user as JwtPayload).id;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as JwtPayload).id;
    await this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req: Request) {
    const userId = (req.user as JwtPayload).id;
    await this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as JwtPayload).id;
    await this.notificationsService.deleteNotification(userId, id);
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Register or update Expo push token' })
  async registerPushToken(@Req() req: Request, @Body() dto: RegisterPushTokenDto) {
    const userId = (req.user as JwtPayload).id;
    await this.notificationsService.updatePushToken(userId, dto.token);
    return { message: 'Push token registered' };
  }

  @Post('push-token/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove push token (disable push notifications)' })
  async removePushToken(@Req() req: Request) {
    const userId = (req.user as JwtPayload).id;
    await this.notificationsService.removePushToken(userId);
  }

  @Post('test-scan')
  @ApiOperation({ summary: 'Manually trigger a reminder scan (debug)' })
  async testScan() {
    await this.notificationsService.scanAndSendReminders();
    return { message: 'Reminder scan triggered' };
  }
}
