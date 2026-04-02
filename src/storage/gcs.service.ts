import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Storage, Bucket } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GcsService {
  private readonly storage?: Storage;
  private readonly bucket?: Bucket;
  private readonly initError?: string;

  constructor() {
    const projectId = process.env.GCS_PROJECT_ID?.trim();
    const bucketName = process.env.GCS_BUCKET?.trim();
    const gcsKeyJson = process.env.GCS_KEY_JSON?.trim();
    const credentialsPathRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    if (!projectId) {
      this.initError = 'GCS_PROJECT_ID is not set';
      return;
    }
    if (!bucketName) {
      this.initError = 'GCS_BUCKET is not set';
      return;
    }

    const storageOptions: any = { projectId };

    if (gcsKeyJson && gcsKeyJson.startsWith('{')) {
      try {
        storageOptions.credentials = JSON.parse(gcsKeyJson);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.initError = `Invalid GCS_KEY_JSON content: ${message}`;
        return;
      }
    } else if (credentialsPathRaw) {
      const credentialsPath = path.isAbsolute(credentialsPathRaw)
        ? credentialsPathRaw
        : path.resolve(process.cwd(), credentialsPathRaw);

      if (!fs.existsSync(credentialsPath)) {
        this.initError =
          `GOOGLE_APPLICATION_CREDENTIALS file not found at "${credentialsPath}". ` +
          'Create the file or update GOOGLE_APPLICATION_CREDENTIALS in .env';
        return;
      }
      storageOptions.keyFilename = credentialsPath;
    }

    this.storage = new Storage(storageOptions);
    this.bucket = this.storage.bucket(bucketName);
  }

  private ensureObjectPath(objectPath: string): string {
    const p = objectPath?.trim();
    if (!p) throw new Error('objectPath is required');
    if (p.startsWith('/')) throw new Error('objectPath must not start with "/"');
    return p;
  }

  private ensureInitialized(): void {
    if (!this.bucket || !this.storage) {
      throw new ServiceUnavailableException(
        this.initError ||
          'GCS is not configured. Set GCS_PROJECT_ID, GCS_BUCKET and GOOGLE_APPLICATION_CREDENTIALS.',
      );
    }
  }

  private getBucket(): Bucket {
    this.ensureInitialized();
    return this.bucket as Bucket;
  }

  async getSignedWriteUrl(objectPath: string, mimeType: string, expiresSec = 600): Promise<string> {
    const bucket = this.getBucket();
    const path = this.ensureObjectPath(objectPath);
    const ct = mimeType?.trim();
    if (!ct) throw new Error('contentType is required');

    const expiresMs = Date.now() + Math.max(1, expiresSec) * 1000;

    let url: string;
    try {
      [url] = await bucket.file(path).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresMs,
        contentType: ct, // Frontend PUT'ta birebir aynı olmalı
      });
    } catch {
      throw new ServiceUnavailableException(
        'GCS credentials are invalid or missing. Check GOOGLE_APPLICATION_CREDENTIALS and service account access.',
      );
    }

    return url;
  }

  async getSignedReadUrl(objectPath: string, expiresSec = 600): Promise<string> {
    const bucket = this.getBucket();
    const path = this.ensureObjectPath(objectPath);
    const expiresMs = Date.now() + Math.max(1, expiresSec) * 1000;

    let url: string;
    try {
      [url] = await bucket.file(path).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresMs,
      });
    } catch {
      throw new ServiceUnavailableException(
        'GCS credentials are invalid or missing. Check GOOGLE_APPLICATION_CREDENTIALS and service account access.',
      );
    }

    return url;
  }

  async deleteObject(objectPath: string): Promise<void> {
    const bucket = this.getBucket();
    const path = this.ensureObjectPath(objectPath);
    await bucket.file(path).delete({ ignoreNotFound: true });
  }
}
