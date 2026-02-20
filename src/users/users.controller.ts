import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProfileResponseDto } from '../common/dto/users/profile-response.dto';
import { UpdateProfileDto } from '../common/dto/users/update-profile.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Returns the logged-in user's profile (name, email, age, avatar, XP)
  @UseGuards(AuthGuard)
  @Get('me')
  async getProfile(@Req() req: Request): Promise<ProfileResponseDto> {
    const userId = (req.user as any).id;
    return this.usersService.getProfile(userId);
  }

  // Updates the logged-in user's profile fields (name, avatarUrl)
  @UseGuards(AuthGuard)
  @Patch('me')
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const userId = (req.user as any).id;
    return this.usersService.updateProfile(userId, dto);
  }
}
