import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GcsService } from './gcs.service';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
  return ALLOWED_MIME.includes(mime as AllowedMime);
}

@Injectable()
export class SignedUrlService {
  constructor(private readonly gcs: GcsService) {}

  async createUploadUrl(
    userId: string,
    fileName: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; objectPath: string; expiresInSeconds: number }> {
    if (!isAllowedMime(mimeType)) {
      throw new BadRequestException('Unsupported mimeType');
    }

    if (!userId?.trim()) throw new BadRequestException('userId is required');
    if (!fileName?.trim()) throw new BadRequestException('fileName is required');

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `tmp/verification/${userId}/${Date.now()}-${randomUUID()}-${safeName}`;

    const uploadUrl = await this.gcs.getSignedWriteUrl(objectPath, mimeType, 180);

    return { uploadUrl, objectPath, expiresInSeconds: 180 };
  }
}
