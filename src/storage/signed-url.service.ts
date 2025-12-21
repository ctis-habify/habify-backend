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
  async createUploadUrl(userId: string, fileName: string, mimeType: string) {
    if (!isAllowedMime) {
      throw new BadRequestException('Unsupported mimeType');
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `tmp/verification/${userId}/${Date.now()}-${randomUUID()}-${safeName}`;

    const file = (await this.gcs.getBucket()).file(objectPath);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 3 * 60 * 1000,
      contentType: mimeType,
    });

    return { uploadUrl, objectPath, expiresInSeconds: 180 };
  }
}
