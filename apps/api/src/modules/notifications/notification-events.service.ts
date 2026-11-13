import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationEvents {
  private readonly logger = new Logger(NotificationEvents.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async assignmentCreated(assignmentId: string): Promise<void> {
    try {
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          exam: { select: { title: true } },
          classroom: {
            select: {
              name: true,
              members: { select: { userId: true } },
            },
          },
          targets: { select: { studentId: true } },
        },
      });
      if (!assignment) return;

      const studentIds =
        assignment.targets.length > 0
          ? assignment.targets.map((t) => t.studentId)
          : assignment.classroom.members.map((m) => m.userId);

      await this.notifications.notify(studentIds, {
        type: 'NEW_ASSIGNMENT',
        title: 'Bài tập mới',
        body: `Bài kiểm tra «${assignment.exam.title}» đã được giao trong lớp «${assignment.classroom.name}»`,
        link: `/assignments/${assignmentId}`,
        dedupeKey: `assignment:${assignmentId}`,
      });
    } catch (error) {
      this.logger.error(
        `assignmentCreated failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async attemptSubmitted(attemptId: string): Promise<void> {
    try {
      const attempt = await this.prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: {
          student: { select: { displayName: true } },
          exam: { select: { title: true, ownerId: true } },
        },
      });
      if (!attempt) return;

      await this.notifications.notify([attempt.exam.ownerId], {
        type: 'SUBMISSION_RECEIVED',
        title: 'Bài làm mới',
        body: `«${attempt.student.displayName}» đã nộp bài kiểm tra «${attempt.exam.title}»`,
        link: `/attempts/${attemptId}/review`,
        dedupeKey: `submitted:${attemptId}`,
      });
    } catch (error) {
      this.logger.error(
        `attemptSubmitted failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async gradingCompleted(attemptId: string): Promise<void> {
    try {
      const attempt = await this.prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: {
          exam: { select: { title: true } },
        },
      });
      if (!attempt) return;

      await this.notifications.notify([attempt.studentId], {
        type: 'GRADING_COMPLETE',
        title: 'Đã chấm điểm',
        body: `Bài kiểm tra «${attempt.exam.title}» của bạn đã được chấm điểm`,
        link: `/attempts/${attemptId}/result`,
        dedupeKey: `graded:${attemptId}`,
      });
    } catch (error) {
      this.logger.error(
        `gradingCompleted failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async resultsReleased(examId: string): Promise<void> {
    try {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: { title: true },
      });
      if (!exam) return;

      const attempts = await this.prisma.examAttempt.findMany({
        where: { examId, status: 'SUBMITTED' },
        select: { studentId: true },
        distinct: ['studentId'],
      });

      const studentIds = attempts.map((a) => a.studentId);
      await this.notifications.notify(studentIds, {
        type: 'RESULTS_RELEASED',
        title: 'Kết quả được công bố',
        body: `Kết quả bài kiểm tra «${exam.title}» đã được công bố`,
        link: `/exams/${examId}/results`,
      });
    } catch (error) {
      this.logger.error(
        `resultsReleased failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async examRegraded(
    examId: string,
    changedAttemptIds: string[] = [],
  ): Promise<void> {
    try {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: { title: true },
      });
      if (!exam || changedAttemptIds.length === 0) return;

      const attempts = await this.prisma.examAttempt.findMany({
        where: { id: { in: changedAttemptIds } },
        select: { studentId: true },
        distinct: ['studentId'],
      });

      const studentIds = attempts.map((a) => a.studentId);
      await this.notifications.notify(studentIds, {
        type: 'GRADING_COMPLETE',
        title: 'Đã chấm lại',
        body: `Bài kiểm tra «${exam.title}» đã được chấm lại`,
        link: `/exams/${examId}/results`,
      });
    } catch (error) {
      this.logger.error(
        `examRegraded failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async announcementPosted(announcementId: string): Promise<void> {
    try {
      const announcement = await this.prisma.announcement.findUnique({
        where: { id: announcementId },
        include: {
          classroom: {
            select: {
              name: true,
              members: { select: { userId: true } },
            },
          },
        },
      });
      if (!announcement) return;

      const memberIds = announcement.classroom.members.map((m) => m.userId);
      await this.notifications.notify(memberIds, {
        type: 'ANNOUNCEMENT',
        title: 'Thông báo mới',
        body: `Thông báo mới trong lớp «${announcement.classroom.name}»`,
        link: `/classrooms/${announcement.classroomId}/announcements`,
        dedupeKey: `announcement:${announcementId}`,
      });
    } catch (error) {
      this.logger.error(
        `announcementPosted failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deadlineReminder(
    tx: Prisma.TransactionClient,
    assignment: { id: string; dueAt: Date | null },
    interval: string,
    studentIds: string[],
  ): Promise<void> {
    try {
      if (!studentIds.length || !assignment.dueAt) return;

      const fullAssignment = await tx.assignment.findUnique({
        where: { id: assignment.id },
        include: {
          exam: { select: { title: true } },
        },
      });
      if (!fullAssignment) return;

      const dueAtEpoch = assignment.dueAt.getTime();
      await this.notifications.notify(
        studentIds,
        {
          type: 'DEADLINE_REMINDER',
          title: 'Nhắc hạn nộp bài',
          body: `Bài kiểm tra «${fullAssignment.exam.title}» sắp hết hạn (${interval})`,
          link: `/assignments/${assignment.id}`,
          dedupeKey: `reminder:${assignment.id}:${interval}:${dueAtEpoch}`,
        },
        tx,
      );
    } catch (error) {
      this.logger.error(
        `deadlineReminder failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
