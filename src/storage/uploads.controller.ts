import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard'; // sizdeki guard neyse
import { GcsService } from './gcs.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly gcs: GcsService) {}

  @UseGuards(AuthGuard)
  @Post('signed-url')
  async createSignedUrl(@Body() body: { contentType: string; ext?: string }, @Req() req) {
    const userId = req.user.sub;
    const ext = (body.ext ?? 'jpg').toLowerCase();
    const allowed = new Set(['jpg', 'jpeg', 'png', 'webp']);
    const safeExt = allowed.has(ext) ? ext : 'jpg';

    const objectPath = `verifications/${userId}/${Date.now()}.${safeExt}`;

    const signedUrl = await this.gcs.getSignedWriteUrl(objectPath, body.contentType, 600);

    return { signedUrl, objectPath };
  }
}
