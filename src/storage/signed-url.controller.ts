import { Body, Controller, Post } from '@nestjs/common';
import { SignedUrlService } from './signed-url.service';

@Controller('uploads')
export class SignedUrlController {
  constructor(private readonly signedUrlService: SignedUrlService) {}

  @Post('verification-url')
  async createVerificationUploadUrl(
    @Body() body: { userId: string; fileName: string; mimeType: string },
  ) {
    const { userId, fileName, mimeType } = body;
    return this.signedUrlService.createUploadUrl(userId, fileName, mimeType);
  }
}
