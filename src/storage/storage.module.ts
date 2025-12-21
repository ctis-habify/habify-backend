import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { SignedUrlService } from './signed-url.service';
import { GcsService } from './gcs.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [GcsService, SignedUrlService],
  exports: [GcsService],
})
export class StorageModule {}
