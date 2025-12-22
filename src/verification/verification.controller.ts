import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { VerificationService } from './verification.service';
import { Verification } from './verification.entity';
import { SubmitVerificationDto } from './submit-verification.dto';
import { VerificationRequestDto } from './verification-request.dto';

@ApiTags('verification')
@ApiBearerAuth('access-token')
@Controller('verify')
@UseGuards(AuthGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('submit')
  @ApiOkResponse({ type: Verification })
  submit(@Body() dto: SubmitVerificationDto, @Req() req): Promise<Verification> {
    const userId = req.user.sub as string;
    return this.verificationService.submit(dto, userId);
  }

  @Get(':id')
  @ApiOkResponse({ type: Verification })
  async getVerification(
    @Param(new ValidationPipe({ transform: true })) params: VerificationRequestDto,
  ): Promise<Verification> {
    return this.verificationService.findOne(params.id);
  }
}
