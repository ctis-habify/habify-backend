import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bull';

import { UploadsController } from '../src/storage/uploads.controller';
import { VerificationController } from '../src/verification/verification.controller';

import { VerificationService } from '../src/verification/verification.service';
import { GcsService } from '../src/storage/gcs.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('Verification E2E (minimal)', () => {
  let app: INestApplication;

  const gcsMock = {
    getSignedWriteUrl: jest.fn().mockResolvedValue('https://signed-upload-url.example'),
    getSignedReadUrl: jest.fn().mockResolvedValue('https://signed-read-url.example'),
    deleteObject: jest.fn(),
  };

  const verificationQueueMock = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const verificationServiceMock = {
    submit: jest.fn().mockResolvedValue({
      id: 'ver-1',
      status: 'pending',
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController, VerificationController],
      providers: [
        // Auth bypass
        {
          provide: AuthGuard,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'user-1', id: 'user-1' };
              return true;
            },
          },
        },

        // Upload controller bunu kullanıyor
        { provide: GcsService, useValue: gcsMock },

        // Verify controller bunu kullanıyor
        { provide: VerificationService, useValue: verificationServiceMock },

        // Eğer VerificationService içinde InjectQueue varsa, tokenı da verelim
        { provide: getQueueToken('verification'), useValue: verificationQueueMock },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: 'user-1', id: 'user-1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /uploads/signed-url -> signed URL döner', async () => {
    const res = await request(app.getHttpServer())
      .post('/uploads/signed-url')
      .send({ fileName: 'test.jpg', mimeType: 'image/jpeg' })
      .expect(201);

    // Bu endpointin response’u sende muhtemelen:
    // { signedUrl, objectPath }
    expect(res.body.signedUrl ?? res.body.uploadUrl ?? res.body.url).toBeDefined();
    expect(res.body.objectPath).toBeDefined();
  });

  it('POST /verify/submit -> 201 döner ve submit çağrılır', async () => {
    const res = await request(app.getHttpServer())
      .post('/verify/submit')
      .send({
        routineId: 1,
        gcsObjectPath: 'verifications/user-1/1766391994907.jpg',
      })
      .expect(201);

    expect(verificationServiceMock.submit).toHaveBeenCalled();
    expect(res.body).toBeDefined();
  });
});
