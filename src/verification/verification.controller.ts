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
  async submit(@Body() dto: SubmitVerificationDto, @Req() req: Request): Promise<any> {
    const userId = req.user.id;
    const result = await this.verificationService.submit(dto, userId);
    return {
      id: result.id,
      status: result.status,
      isVerified: result.isVerified,
      verified: result.isVerified,
      failReason: result.failReason,
      score: result.score,
    };
  }

  @Get(':id')
  @ApiOkResponse({ type: Verification })
  async getVerification(
    @Param(new ValidationPipe({ transform: true })) params: VerificationRequestDto,
  ): Promise<any> {
    const result = await this.verificationService.findOne(params.id);
    return {
      id: result.id,
      status: result.status,
      isVerified: result.isVerified,
      verified: result.isVerified,
      failReason: result.failReason,
      score: result.score,
    };
  }
}
