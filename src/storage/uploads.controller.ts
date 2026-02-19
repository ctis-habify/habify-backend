import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { GcsService } from './gcs.service';
import { CreateSignedUrlDto } from '../common/dto/storage/create-signed-url.dto';



@Controller('uploads')
export class UploadsController {
  constructor(private readonly gcs: GcsService) {}

  @UseGuards(AuthGuard)
  @Post('signed-url')
  async createSignedUrl(
    @Body() dto: CreateSignedUrlDto,
    @Req() req: Request,
  ): Promise<{ signedUrl: string; objectPath: string }> {
    const userId = req.user.id;
    const ext = (dto.ext ?? 'jpg').toLowerCase();
    const allowed = new Set(['jpg', 'jpeg', 'png', 'webp']);
    const safeExt = allowed.has(ext) ? ext : 'jpg';

    const objectPath = `verifications/${userId}/${Date.now()}.${safeExt}`;

    const signedUrl = await this.gcs.getSignedWriteUrl(objectPath, dto.mimeType, 600);

    return { signedUrl, objectPath };
  }
}
