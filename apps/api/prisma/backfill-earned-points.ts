/**
 * One-off backfill for attempts submitted before answers stored earnedPoints
 * (design.md 2.5 step 6).
 *
 * For every SUBMITTED attempt it runs the grading engine and writes
 * earnedPoints on the answers where it is NULL. It never changes an attempt's
 * score, never changes manuallyGraded, and never overwrites a value that is
 * already set, so it is safe to run more than once.
 *
 * A non-empty essay grades to NULL (needs a teacher) and therefore stays NULL.
 *
 *   npm run backfill:earned-points --workspace=apps/api
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { lockAttempt } from '../src/common/db/locks';
import {
  gradeAnswer,
  parseAnswerPayload,
  snapshotOf,
} from '../src/modules/grading/grading-engine';

const BATCH = 200;

async function main() {
  const prisma = new PrismaClient();
  let attempts = 0;
  let written = 0;
  let cursor: string | undefined;

  try {
    for (;;) {
      const batch = await prisma.examAttempt.findMany({
        where: {
          status: 'SUBMITTED',
          answers: { some: { earnedPoints: null } },
        },
        select: { id: true, examId: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1]!.id;

      for (const attempt of batch) {
        written += await prisma.$transaction(async (tx) => {
          // Same lock as every other writer of earnedPoints.
          if (!(await lockAttempt(tx, attempt.id))) return 0;
          const exam = await tx.exam.findUnique({
            where: { id: attempt.examId },
            select: { gradingMode: true, questions: true },
          });
          if (!exam) return 0;
          const questions = new Map(
            exam.questions.map((q) => [q.id, snapshotOf(q)]),
          );
          const answers = await tx.answer.findMany({
            where: { attemptId: attempt.id, earnedPoints: null },
            select: { id: true, examQuestionId: true, answerPayload: true },
          });

          let count = 0;
          for (const answer of answers) {
            const question = questions.get(answer.examQuestionId);
            if (!question) continue;
            const earned = gradeAnswer(
              question,
              parseAnswerPayload(answer.answerPayload),
              exam.gradingMode,
            );
            if (earned === null) continue;
            const result = await tx.answer.updateMany({
              where: { id: answer.id, earnedPoints: null },
              data: { earnedPoints: new Prisma.Decimal(earned.toFixed(4)) },
            });
            count += result.count;
          }
          return count;
        });
        attempts += 1;
      }
    }
    console.warn(
      `backfill-earned-points: ${attempts} attempt(s) examined, ${written} answer(s) updated`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
