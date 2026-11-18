import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => {
              const map: Record<string, unknown> = {
                SMTP_FROM_NAME: 'Lumi Test',
                SMTP_FROM_ADDRESS: 'test@lumi.local',
              };
              return map[key] ?? fallback;
            },
          },
        },
      ],
    }).compile();

    service = module.get(MailService);
    service.onModuleInit();
    // `logger` is private; reach it through a narrow structural type rather
    // than `any` so a rename still fails the build.
    const withLogger = service as unknown as { logger: Logger };
    logSpy = jest.spyOn(withLogger.logger, 'log');
  });

  it('logs when no SMTP_HOST is set', async () => {
    await service.send({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hello',
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Mail not sent — no SMTP]'),
    );
  });

  it('skips @lumi.local addresses', async () => {
    await service.send({
      to: 'student_abc@lumi.local',
      subject: 'Test',
      text: 'Hello',
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('@lumi.local'),
    );
  });
});
