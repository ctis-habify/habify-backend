import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Storage, Bucket, StorageOptions } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GcsService {
  private readonly logger = new Logger(GcsService.name);
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

    const storageOptions: StorageOptions = { projectId };

    if (gcsKeyJson) {
      try {
        // Strip potential surrounding single or double quotes
        let cleanJson = gcsKeyJson.trim();
        if (
          (cleanJson.startsWith("'") && cleanJson.endsWith("'")) ||
          (cleanJson.startsWith('"') && cleanJson.endsWith('"'))
        ) {
          cleanJson = cleanJson.substring(1, cleanJson.length - 1);
        }

        if (cleanJson.startsWith('{')) {
          const creds = JSON.parse(cleanJson);
          if (creds.private_key) {
            creds.private_key = creds.private_key.replace(/\\n/g, '\n');
          }
          storageOptions.credentials = creds;
        } else {
          throw new Error(
            'GCS_KEY_JSON does not appear to be a valid JSON object (must start with {)',
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.initError = `Invalid GCS_KEY_JSON content: ${message}`;
        this.logger.error(this.initError);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`GCS getSignedReadUrl failed for path "${path}": ${message}`);
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
