import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Tx } from '../../common/db/locks';
import { fail } from '../../common/errors/app-error';
import {
  Decimal,
  GradingMode,
  SnapshotQuestion,
  computeScore,
  gradeAnswer,
  parseAnswerPayload,
  snapshotOf,
} from './grading-engine';

/** What grading one attempt needs to know about its exam. */
export type GradingContext = {
  gradingMode: GradingMode;
  questions: SnapshotQuestion[];
  totalPoints: number;
};

export type GradingProgress = { graded: number; total: number };

type Db = Tx | Prisma.TransactionClient;

@Injectable()
export class GradingService {
  /** Loads the snapshot questions and grading mode of one exam. */
  async loadContext(db: Db, examId: string): Promise<GradingContext> {
    const exam = await db.exam.findUnique({
      where: { id: examId },
      select: {
        gradingMode: true,
        questions: {
          select: {
            id: true,
            points: true,
            typeSnapshot: true,
            optionsSnapshot: true,
            correctAnswerSnapshot: true,
          },
        },
      },
    });
    if (!exam) throw fail(404, 'EXAM_NOT_FOUND', 'Không tìm thấy đề thi');
    const questions = exam.questions.map(snapshotOf);
    return {
      gradingMode: exam.gradingMode,
      questions,
      totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    };
  }

  /**
   * Grades every answer of one attempt and writes earnedPoints. The caller
   * holds lockAttempt and writes the returned score to the attempt.
   *
   * preserveManual = true keeps answers where manuallyGraded is true
   * (regrade). `context` lets a caller that grades many attempts of one exam
   * load the exam once.
   */
  async gradeAttempt(
    tx: Tx,
    attemptId: string,
    opts: { preserveManual: boolean; context?: GradingContext },
  ): Promise<{ score: Decimal; pending: number }> {
    let context = opts.context;
    if (!context) {
      const attempt = await tx.examAttempt.findUnique({
        where: { id: attemptId },
        select: { examId: true },
      });
      if (!attempt) {
        throw fail(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy bài làm');
      }
      context = await this.loadContext(tx, attempt.examId);
    }
    const questionById = new Map(context.questions.map((q) => [q.id, q]));

    const answers = await tx.answer.findMany({
      where: { attemptId },
      select: {
        id: true,
        examQuestionId: true,
        answerPayload: true,
        earnedPoints: true,
        manuallyGraded: true,
      },
    });

    const earned: (Decimal | null)[] = [];
    const updates: { id: string; value: Decimal | null }[] = [];

    for (const answer of answers) {
      const question = questionById.get(answer.examQuestionId);
      // An answer to a question that is no longer in the exam earns nothing.
      if (!question) continue;

      let value: Decimal | null;
      if (opts.preserveManual && answer.manuallyGraded) {
        value = answer.earnedPoints;
      } else {
        value = gradeAnswer(
          question,
          parseAnswerPayload(answer.answerPayload),
          context.gradingMode,
        );
        const unchanged =
          value === null
            ? answer.earnedPoints === null
            : answer.earnedPoints !== null && value.equals(answer.earnedPoints);
        if (!unchanged) updates.push({ id: answer.id, value });
      }
      earned.push(value);
    }

    if (updates.length > 0) {
      // One statement per attempt, not one per answer.
      const rows = updates.map(
        (u) =>
          Prisma.sql`(${u.id}::uuid, ${
            u.value === null ? null : u.value.toFixed(4)
          }::numeric)`,
      );
      await tx.$executeRaw`
        UPDATE answers AS a
        SET earned_points = v.earned
        FROM (VALUES ${Prisma.join(rows)}) AS v(id, earned)
        WHERE a.id = v.id`;
    }

    return {
      score: computeScore(earned, context.totalPoints),
      pending: earned.filter((value) => value === null).length,
    };
  }

  /**
   * Re-reads the stored earnedPoints and returns the score and the grading
   * progress. Used after a manual grade and by read endpoints.
   *
   * total = number of exam questions; graded = total minus the answers whose
   * earnedPoints is NULL. A question with no answer row is graded, at 0.
   */
  async recalculateScore(
    db: Db,
    attemptId: string,
  ): Promise<{ score: Decimal; graded: number; total: number }> {
    const attempt = await db.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        exam: { select: { questions: { select: { id: true, points: true } } } },
        answers: { select: { examQuestionId: true, earnedPoints: true } },
      },
    });
    if (!attempt) {
      throw fail(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy bài làm');
    }
    const questionIds = new Set(attempt.exam.questions.map((q) => q.id));
    const totalPoints = attempt.exam.questions.reduce(
      (sum, q) => sum + q.points,
      0,
    );
    const earned = attempt.answers
      .filter((a) => questionIds.has(a.examQuestionId))
      .map((a) => a.earnedPoints);
    const total = questionIds.size;
    return {
      score: computeScore(earned, totalPoints),
      graded: total - earned.filter((value) => value === null).length,
      total,
    };
  }

  /**
   * Grading progress for many attempts of one exam in two queries.
   * Attempts without an entry in the result have nothing pending.
   */
  async progressForExam(
    db: Db,
    examId: string,
    attemptIds: string[],
  ): Promise<{ total: number; pendingByAttempt: Map<string, number> }> {
    const total = await db.examQuestion.count({ where: { examId } });
    const pendingByAttempt = new Map<string, number>();
    if (attemptIds.length > 0) {
      const groups = await db.answer.groupBy({
        by: ['attemptId'],
        where: {
          attemptId: { in: attemptIds },
          earnedPoints: null,
          examQuestion: { examId },
        },
        _count: { _all: true },
      });
      for (const g of groups) pendingByAttempt.set(g.attemptId, g._count._all);
    }
    return { total, pendingByAttempt };
  }
}
