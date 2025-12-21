import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { SignedUrlService } from './signed-url.service';
import { GcsService } from './gcs.service';

@Module({
  controllers: [UploadsController],
  providers: [GcsService, SignedUrlService],
})
export class StorageModule {}
