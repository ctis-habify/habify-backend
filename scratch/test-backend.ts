
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RoutinesService } from '../src/routines/routines.service';
import { GcsService } from '../src/storage/gcs.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const routinesService = app.get(RoutinesService) as any;
  const gcsService = app.get(GcsService) as any;

  console.log('--- Testing Public Routines Sorting ---');
  try {
    const publicRoutines = await routinesService.browsePublicRoutines('system-test-id');
    console.log(`Found ${publicRoutines.length} public routines.`);
    if (publicRoutines.length > 1) {
      const first = publicRoutines[0];
      const second = publicRoutines[1];
      console.log('First routine:', first.routineName, 'createdAt:', first.createdAt);
      console.log('Second routine:', second.routineName, 'createdAt:', second.createdAt);
      
      const d1 = new Date(first.createdAt).getTime();
      const d2 = new Date(second.createdAt).getTime();
      if (d1 >= d2) {
        console.log('✅ Sorting is correct (DESC by createdAt)');
      } else {
        console.log('❌ Sorting is incorrect');
      }
    }
  } catch (err: any) {
    console.error('Public routines test failed:', err.message);
  }

  console.log('\n--- Testing GCS Signed URL Generation ---');
  try {
    const testPath = 'test-folder/test-photo.jpg';
    const signedUrl = await gcsService.getSignedReadUrl(testPath, 3600);
    console.log('Generated Signed URL starts with http:', signedUrl.startsWith('http'));
    console.log('Sample URL:', signedUrl.substring(0, 50) + '...');
    if (signedUrl.startsWith('http')) {
       console.log('✅ GCS Signed URL generation is working');
    }
  } catch (err: any) {
    console.error('GCS Signed URL test failed:', err.message);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
