import { Test, TestingModule } from '@nestjs/testing';
import { GcsService } from './gcs.service';

describe('GcsService (Unit)', () => {
  let service: GcsService;

  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ['GCS_PROJECT_ID']: 'test-project',
      ['GCS_BUCKET']: 'test-bucket',
      ['GCS_KEY_JSON']: JSON.stringify({
        ['project_id']: 'test-project',
        ['private_key']: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----',
        ['client_email']: 'test@test.com',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GcsService],
    }).compile();

    service = module.get<GcsService>(GcsService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should initialize GCS with formatted private key', () => {
    // Check for init error
    const initError = (service as any).initError;
    if (initError) {
      throw new Error(`GcsService failed to initialize: ${initError}`);
    }

    const storage = (service as any).storage;
    expect(storage).toBeDefined();

    // Some versions of @google-cloud/storage store it differently
    const pId = storage.projectId || storage.options?.projectId;
    expect(pId).toBe('test-project');
  });

  it('getSignedReadUrl should call getSignedUrl with correct params', async () => {
    const mockFile = {
      getSignedUrl: jest.fn().mockResolvedValue(['https://signed-url.com']),
    };
    (service as any).bucket = {
      file: jest.fn().mockReturnValue(mockFile),
    };

    const url = await service.getSignedReadUrl('test.jpg');
    expect(url).toBe('https://signed-url.com');
    expect(mockFile.getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read',
        version: 'v4',
      }),
    );
  });
});
