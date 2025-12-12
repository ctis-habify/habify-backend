import { Module } from '@nestjs/common';
import { SignedUrlController } from './signed-url.controller';
import { SignedUrlService } from './signed-url.service';
import { GcsService } from './gcs.service';

@Module({
  controllers: [SignedUrlController],
  providers: [GcsService, SignedUrlService],
})
export class StorageModule {}
