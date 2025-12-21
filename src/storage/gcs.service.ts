import { Injectable } from '@nestjs/common';
import { Bucket, Storage } from '@google-cloud/storage';

@Injectable()
export class GcsService {
  private storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  private bucket = this.storage.bucket(process.env.GCS_BUCKET!);

  async getBucket(): Promise<Bucket> {
    return this.bucket;
  }

  async getSignedWriteUrl(objectPath: string, contentType: string, expiresSec = 600) {
    const [url] = await this.bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresSec * 1000,
      contentType, // PUT'ta aynı olmalı
    });
    return url;
  }

  async getSignedReadUrl(objectPath: string, expiresSec = 600) {
    const [url] = await this.bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresSec * 1000,
    });
    return url;
  }
}
