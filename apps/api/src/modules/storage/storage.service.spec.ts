import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => {
              if (key === 'MINIO_BUCKET') return 'test-bucket';
              return fallback;
            },
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  it('isConfigured returns false when no endpoint', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('put throws STORAGE_UNAVAILABLE when not configured', async () => {
    await expect(
      service.put('key', Buffer.from('data'), 'text/plain'),
    ).rejects.toMatchObject({
      response: { code: 'STORAGE_UNAVAILABLE' },
    });
  });

  it('getStream throws STORAGE_UNAVAILABLE when not configured', async () => {
    await expect(service.getStream('key')).rejects.toMatchObject({
      response: { code: 'STORAGE_UNAVAILABLE' },
    });
  });

  it('remove throws STORAGE_UNAVAILABLE when not configured', async () => {
    await expect(service.remove('key')).rejects.toMatchObject({
      response: { code: 'STORAGE_UNAVAILABLE' },
    });
  });
});
