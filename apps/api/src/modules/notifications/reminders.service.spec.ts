jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  ScheduleModule: { forRoot: () => ({ module: class {} }) },
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEvents } from './notification-events.service';

describe('RemindersService', () => {
  let service: RemindersService;
  let checkSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RemindersService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => {
              if (key === 'REMINDERS_ENABLED') return false;
              return fallback;
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: NotificationEvents,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(RemindersService);
    checkSpy = jest.spyOn(service, 'checkAndSendReminders');
  });

  it('handleCron returns immediately when REMINDERS_ENABLED=false', async () => {
    await service.handleCron();
    expect(checkSpy).not.toHaveBeenCalled();
  });
});
