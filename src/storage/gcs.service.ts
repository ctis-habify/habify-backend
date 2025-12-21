import { Injectable } from '@nestjs/common';
import { Storage, Bucket } from '@google-cloud/storage';

@Injectable()
export class GcsService {
  private readonly storage: Storage;
  private readonly bucket: Bucket;

  constructor() {
    const projectId = process.env.GCS_PROJECT_ID?.trim();
    const bucketName = process.env.GCS_BUCKET?.trim();

    if (!projectId) {
      throw new Error('GCP_PROJECT_ID is not set');
    }
    if (!bucketName) {
      throw new Error('GCS_BUCKET is not set');
    }
    this.storage = new Storage({ projectId });
    this.bucket = this.storage.bucket(bucketName);
  }

  private ensureObjectPath(objectPath: string) {
    const p = objectPath?.trim();
    if (!p) throw new Error('objectPath is required');
    if (p.startsWith('/')) throw new Error('objectPath must not start with "/"');
    return p;
  }

  async getSignedWriteUrl(
    objectPath: string,
    contentType: string,
    expiresSec = 600,
  ): Promise<string> {
    const path = this.ensureObjectPath(objectPath);
    const ct = contentType?.trim();
    if (!ct) throw new Error('contentType is required');

    const expiresMs = Date.now() + Math.max(1, expiresSec) * 1000;

    const [url] = await this.bucket.file(path).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresMs,
      contentType: ct, // Frontend PUT'ta birebir aynı olmalı
    });

    return url;
  }

  async getSignedReadUrl(objectPath: string, expiresSec = 600): Promise<string> {
    const path = this.ensureObjectPath(objectPath);
    const expiresMs = Date.now() + Math.max(1, expiresSec) * 1000;

    const [url] = await this.bucket.file(path).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresMs,
    });

    return url;
  }

  async deleteObject(objectPath: string): Promise<void> {
    const path = this.ensureObjectPath(objectPath);
    await this.bucket.file(path).delete({ ignoreNotFound: true });
  }
}
