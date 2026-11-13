import { Injectable, Logger } from '@nestjs/common';
import { ExamAttempt, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TX_OPTIONS, Tx, lockAttempt } from '../../common/db/locks';
import { fail } from '../../common/errors/app-error';
import { runAfterCommit } from '../../common/utils/after-commit';
import { NotificationEvents } from '../notifications/notification-events.service';
import { GradingService } from './grading.service';

export type SweepScope =
  { examId: string } | { assignmentId: string } | { classroomId: string };

/**
 * The only code that moves an attempt out of IN_PROGRESS.
 */
@Injectable()
export class AttemptLifecycleService {
  private readonly logger = new Logger(AttemptLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
    private readonly events: NotificationEvents,
  ) {}

  /**
   * Grades the attempt and marks it SUBMITTED. The caller holds lockAttempt
   * and has seen status IN_PROGRESS under that lock. After its transaction
   * commits the caller must call notifySubmitted().
   *
   * submittedAt is min(now, expiresAt): under lazy expiry "now" can be long
   * after the deadline.
   */
  async finalize(
    tx: Tx,
    attempt: { id: string; expiresAt: Date },
    now: Date,
  ): Promise<ExamAttempt> {
    const { score } = await this.grading.gradeAttempt(tx, attempt.id, {
      preserveManual: false,
    });
    const submittedAt = now < attempt.expiresAt ? now : attempt.expiresAt;
    return tx.examAttempt.update({
      where: { id: attempt.id },
      data: { status: 'SUBMITTED', submittedAt, score },
    });
  }

  /** Announces a submission. Call only after the finalize commit. */
  async notifySubmitted(attemptId: string): Promise<void> {
    await runAfterCommit(this.logger, `attemptSubmitted ${attemptId}`, () =>
      this.events.attemptSubmitted(attemptId),
    );
  }

  /**
   * Student submit (design 5.3). One transaction: row lock, owner check; an
   * attempt that is already SUBMITTED is returned as stored, without
   * grading again.
   */
  async submitByStudent(
    attemptId: string,
    studentId: string,
  ): Promise<ExamAttempt> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const found = await lockAttempt(tx, attemptId);
      const attempt = found
        ? await tx.examAttempt.findUnique({ where: { id: attemptId } })
        : null;
      if (!attempt) {
        throw fail(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy bài làm');
      }
      if (attempt.studentId !== studentId) {
        throw fail(
          403,
          'NOT_ATTEMPT_OWNER',
          'Bạn không có quyền với bài làm này',
        );
      }
      if (attempt.status !== 'IN_PROGRESS') {
        return { attempt, finalized: false };
      }
      return {
        attempt: await this.finalize(tx, attempt, now),
        finalized: true,
      };
    }, TX_OPTIONS);

    if (result.finalized) await this.notifySubmitted(attemptId);
    return result.attempt;
  }

  /**
   * Lazy expiry. Own transaction: row lock, re-check IN_PROGRESS and
   * now > expiresAt under the lock, finalize. A no-op otherwise.
   * Returns true when this call submitted the attempt.
   */
  async submitIfExpired(attemptId: string): Promise<boolean> {
    const now = new Date();
    const finalized = await this.prisma.$transaction(async (tx) => {
      if (!(await lockAttempt(tx, attemptId))) return false;
      const attempt = await tx.examAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt || attempt.status !== 'IN_PROGRESS') return false;
      if (now <= attempt.expiresAt) return false;
      await this.finalize(tx, attempt, now);
      return true;
    }, TX_OPTIONS);

    if (finalized) await this.notifySubmitted(attemptId);
    return finalized;
  }

  /**
   * Lazy expiry for teacher-facing reads: submits every IN_PROGRESS attempt
   * in scope that is past expiresAt. Returns how many were submitted.
   */
  async sweepExpired(scope: SweepScope): Promise<number> {
    let where: Prisma.ExamAttemptWhereInput;
    if ('examId' in scope) {
      where = { examId: scope.examId };
    } else if ('assignmentId' in scope) {
      where = { assignmentId: scope.assignmentId };
    } else {
      where = {
        OR: [
          { assignment: { classroomId: scope.classroomId } },
          // Attempts from before every attempt carried an assignment.
          {
            assignmentId: null,
            exam: { assignments: { some: { classroomId: scope.classroomId } } },
          },
        ],
      };
    }

    const expired = await this.prisma.examAttempt.findMany({
      where: { ...where, status: 'IN_PROGRESS', expiresAt: { lt: new Date() } },
      select: { id: true },
    });

    let submitted = 0;
    for (const { id } of expired) {
      if (await this.submitIfExpired(id)) submitted += 1;
    }
    return submitted;
  }
}
