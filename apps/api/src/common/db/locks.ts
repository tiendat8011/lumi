import { Prisma } from '@prisma/client';

/**
 * The only place raw locking SQL lives. Every helper takes the transaction
 * client: a lock taken outside a transaction is released immediately.
 *
 * Row-lock helpers return false when the row does not exist.
 */
export type Tx = Prisma.TransactionClient;

/** Options for interactive transactions (design 5). */
export const TX_OPTIONS = { maxWait: 5000, timeout: 10000 } as const;
export const TX_OPTIONS_LONG = { maxWait: 5000, timeout: 60000 } as const;

type IdRow = { id: string };

/** Exclusive lock on one attempt: submit, auto-submit, grading, override. */
export async function lockAttempt(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT id FROM exam_attempts WHERE id = ${id}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/** Shared lock on one attempt: save answer. Conflicts with lockAttempt. */
export async function shareAttempt(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT id FROM exam_attempts WHERE id = ${id}::uuid FOR SHARE`;
  return rows.length > 0;
}

/** Exclusive lock on one exam: publish, archive, add or remove a question. */
export async function lockExam(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT id FROM exams WHERE id = ${id}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/** Exclusive lock on one assignment: update, targets, attachments, reminders. */
export async function lockAssignment(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT id FROM assignments WHERE id = ${id}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/** Exclusive lock on one user: student-creation limit, disable account. */
export async function lockUser(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Locks every SUBMITTED attempt of an exam and returns their ids (regrade).
 */
export async function lockSubmittedAttempts(
  tx: Tx,
  examId: string,
): Promise<string[]> {
  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT id FROM exam_attempts
    WHERE exam_id = ${examId}::uuid AND status = 'SUBMITTED'
    ORDER BY id
    FOR UPDATE`;
  return rows.map((r) => r.id);
}

/**
 * Serialises "start attempt" for one student and one exam. A transaction-
 * scoped advisory lock: released at commit or rollback, never held across
 * requests.
 */
export async function lockStart(
  tx: Tx,
  studentId: string,
  examId: string,
): Promise<void> {
  const key = `${studentId}:${examId}`;
  // The ::text cast on the result avoids Prisma's "void" column type error.
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))::text`;
}
