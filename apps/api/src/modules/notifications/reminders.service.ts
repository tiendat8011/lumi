import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { TX_OPTIONS } from '../../common/db/locks';
import { NotificationEvents } from './notification-events.service';

const INTERVALS: { label: string; ms: number }[] = [
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
];

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: NotificationEvents,
  ) {}

  @Cron('*/5 * * * *')
  async handleCron(): Promise<void> {
    if (!this.config.get<boolean>('REMINDERS_ENABLED', true)) return;
    try {
      await this.checkAndSendReminders(new Date());
    } catch (error) {
      this.logger.error(
        `Reminder cron failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async checkAndSendReminders(now: Date): Promise<void> {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        status: 'ACTIVE',
        dueAt: { gt: now },
      },
      select: {
        id: true,
        dueAt: true,
        reminderIntervals: true,
        classroom: {
          select: {
            members: { select: { userId: true } },
          },
        },
      },
    });

    for (const assignment of assignments) {
      if (!assignment.dueAt) continue;

      const intervals = this.parseIntervals(assignment.reminderIntervals);
      for (const interval of intervals) {
        const config = INTERVALS.find((i) => i.label === interval);
        if (!config) continue;

        const triggerAt = new Date(
          assignment.dueAt.getTime() - config.ms,
        );
        if (now < triggerAt) continue;

        const alreadySent = await this.prisma.deadlineReminder.findUnique({
          where: {
            assignmentId_interval: {
              assignmentId: assignment.id,
              interval,
            },
          },
        });
        if (alreadySent) continue;

        const submittedStudents = await this.prisma.examAttempt.findMany({
          where: {
            assignmentId: assignment.id,
            status: 'SUBMITTED',
          },
          select: { studentId: true },
          distinct: ['studentId'],
        });
        const submittedSet = new Set(
          submittedStudents.map((s) => s.studentId),
        );
        const eligible = assignment.classroom.members
          .map((m) => m.userId)
          .filter((id) => !submittedSet.has(id));

        if (eligible.length === 0) continue;

        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.deadlineReminder.create({
              data: {
                assignmentId: assignment.id,
                interval,
                recipientCount: eligible.length,
              },
            });
            await this.events.deadlineReminder(
              tx,
              { id: assignment.id, dueAt: assignment.dueAt },
              interval,
              eligible,
            );
          }, TX_OPTIONS);
        } catch (error) {
          this.logger.error(
            `Reminder for assignment ${assignment.id} (${interval}) failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }

  private parseIntervals(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return ['24h', '1h'];
  }
}
