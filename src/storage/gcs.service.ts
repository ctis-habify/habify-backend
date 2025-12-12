import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';

@Injectable()
export class GcsService {
  private storage: Storage;
  private bucket: Bucket;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('GCS_PROJECT_ID');
    const keyFilename = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    const bucketName = this.config.get<string>('GCS_BUCKET');

    if (!projectId || !keyFilename || !bucketName) {
      throw new Error(
        `Missing GCS env vars. Got: GCS_PROJECT_ID=${projectId}, GOOGLE_APPLICATION_CREDENTIALS=${keyFilename}, GCS_BUCKET=${bucketName}`,
      );
    }

    this.storage = new Storage({ projectId, keyFilename });
    this.bucket = this.storage.bucket(bucketName);
  }

  getBucket() {
    return this.bucket;
  }
}
