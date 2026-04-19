import { Body, Controller, Get, Param, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { VerificationService } from './verification.service';
import { Verification } from './verification.entity';
import { SubmitVerificationDto } from '../common/dto/verification/submit-verification.dto';
import { VerificationRequestDto } from '../common/dto/verification/verification-request.dto';

import type { Request } from 'express';

@ApiTags('verification')
@ApiBearerAuth('access-token')
@Controller('verify')
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('submit')
  @ApiOkResponse({ type: Verification })
  async submit(@Body() dto: SubmitVerificationDto, @Req() req: Request): Promise<Record<string, unknown>> {
    const userId = req.user.id;
    const saved = await this.verificationService.submit(dto, userId);

    // Objenin içindeki tüm alanları tek tek ve garanti bir şekilde gönderiyoruz.
    return {
      id: saved.id,
      status: saved.status,
      userId: saved.userId,
      verificationImageUrl: saved.verificationImageUrl,
      isVerified: saved.isVerified,
      verified: saved.isVerified,
      failReason: saved.failReason || null,
      score: saved.score || 0,
      createdAt: saved.createdAt,
    };
  }

  @Get(':id')
  @ApiOkResponse({ type: Verification })
  async getVerification(
    @Param(new ValidationPipe({ transform: true })) params: VerificationRequestDto,
  ): Promise<Record<string, unknown>> {
    const found = await this.verificationService.findOne(params.id);

    return {
      id: found.id,
      status: found.status,
      userId: found.userId,
      verificationImageUrl: found.verificationImageUrl,
      isVerified: found.isVerified,
      verified: found.isVerified,
      failReason: found.failReason || null,
      score: found.score || 0,
      createdAt: found.createdAt,
    };
  }
}
