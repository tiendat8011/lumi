import { Prisma } from '@prisma/client';
import { normalizeAnswerText } from '../../common/utils/text';

/**
 * The grading rules. Pure: no database, no clock. Every path that produces
 * a score (submit, auto-submit, regrade, manual grading, backfill) goes
 * through these two functions.
 */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export const QUESTION_TYPES = [
  'MCQ',
  'MCQ_MULTI',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'FILL_BLANK',
  'ESSAY',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type GradingMode = 'ALL_OR_NOTHING' | 'PARTIAL';

export type SnapshotOption = {
  id: string;
  content: string;
  isCorrect: boolean;
  position: number;
};

export type SnapshotQuestion = {
  id: string;
  points: number;
  /** typeSnapshot; null for exams published before snapshots carried a type. */
  type: QuestionType | null;
  options: { id: string; isCorrect: boolean }[] | null;
  /** correctAnswerSnapshot */
  correctAnswer: string | null;
};

export type AnswerPayload = {
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  text?: string;
};

const ZERO = new Decimal(0);
const EARNED_DP = 4;
const SCORE_DP = 2;

export function isQuestionType(value: unknown): value is QuestionType {
  return (
    typeof value === 'string' &&
    (QUESTION_TYPES as readonly string[]).includes(value)
  );
}

/** Reads an optionsSnapshot JSON value. Null when it is not an array. */
export function parseOptionsSnapshot(json: unknown): SnapshotOption[] | null {
  if (!Array.isArray(json)) return null;
  const out: SnapshotOption[] = [];
  json.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const o = raw as Record<string, unknown>;
    if (typeof o['id'] !== 'string') return;
    out.push({
      id: o['id'],
      content: typeof o['content'] === 'string' ? o['content'] : '',
      isCorrect: o['isCorrect'] === true,
      position: typeof o['position'] === 'number' ? o['position'] : index,
    });
  });
  return out;
}

/** Maps an exam_questions row to what the engine grades against. */
export function snapshotOf(eq: {
  id: string;
  points: number;
  typeSnapshot: string | null;
  optionsSnapshot: unknown;
  correctAnswerSnapshot: string | null;
}): SnapshotQuestion {
  return {
    id: eq.id,
    points: eq.points,
    type: isQuestionType(eq.typeSnapshot) ? eq.typeSnapshot : null,
    options: parseOptionsSnapshot(eq.optionsSnapshot),
    correctAnswer: eq.correctAnswerSnapshot,
  };
}

/**
 * The type to grade and display a question as. A legacy snapshot without a
 * type is inferred: more than one correct option is MCQ_MULTI, any options
 * is MCQ, no options but an answer key is SHORT_ANSWER, otherwise ESSAY.
 */
export function resolveType(
  q: Pick<SnapshotQuestion, 'type' | 'options' | 'correctAnswer'>,
): QuestionType {
  if (q.type) return q.type;
  if (q.options && q.options.length > 0) {
    return q.options.filter((o) => o.isCorrect).length > 1
      ? 'MCQ_MULTI'
      : 'MCQ';
  }
  if (q.correctAnswer !== null && q.correctAnswer.trim() !== '') {
    return 'SHORT_ANSWER';
  }
  return 'ESSAY';
}

/** Reads an answerPayload JSON value, dropping anything of the wrong type. */
export function parseAnswerPayload(json: unknown): AnswerPayload | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const raw = json as Record<string, unknown>;
  const payload: AnswerPayload = {};
  if (typeof raw['selectedOptionId'] === 'string') {
    payload.selectedOptionId = raw['selectedOptionId'];
  }
  if (Array.isArray(raw['selectedOptionIds'])) {
    payload.selectedOptionIds = raw['selectedOptionIds'].filter(
      (v): v is string => typeof v === 'string',
    );
  }
  if (typeof raw['text'] === 'string') payload.text = raw['text'];
  return payload;
}

function selectedIds(payload: AnswerPayload): string[] {
  if (payload.selectedOptionIds) return [...new Set(payload.selectedOptionIds)];
  // A payload saved before multi-select existed: a one-element selection.
  if (payload.selectedOptionId) return [payload.selectedOptionId];
  return [];
}

function full(q: SnapshotQuestion): Decimal {
  return new Decimal(q.points).toDecimalPlaces(
    EARNED_DP,
    Decimal.ROUND_HALF_UP,
  );
}

/**
 * Earned points for one answer, 4 decimal places, ROUND_HALF_UP.
 * Null means a human must grade it (a non-empty essay).
 */
export function gradeAnswer(
  q: SnapshotQuestion,
  payload: AnswerPayload | null,
  mode: GradingMode,
): Decimal | null {
  if (!payload) return ZERO;
  const type = resolveType(q);
  const options = q.options ?? [];

  switch (type) {
    case 'MCQ':
    case 'TRUE_FALSE': {
      const ids = selectedIds(payload);
      if (ids.length !== 1) return ZERO;
      const selected = options.find((o) => o.id === ids[0]);
      return selected?.isCorrect ? full(q) : ZERO;
    }

    case 'MCQ_MULTI': {
      const ids = selectedIds(payload);
      if (ids.length === 0) return ZERO;
      const correct = new Set(
        options.filter((o) => o.isCorrect).map((o) => o.id),
      );
      if (correct.size === 0) return ZERO;
      const correctSelected = ids.filter((id) => correct.has(id)).length;
      const incorrectSelected = ids.length - correctSelected;

      if (mode === 'PARTIAL') {
        const net = Math.max(0, correctSelected - incorrectSelected);
        return new Decimal(net)
          .div(correct.size)
          .mul(q.points)
          .toDecimalPlaces(EARNED_DP, Decimal.ROUND_HALF_UP);
      }
      return incorrectSelected === 0 && correctSelected === correct.size
        ? full(q)
        : ZERO;
    }

    case 'SHORT_ANSWER':
    case 'FILL_BLANK': {
      const given = normalizeAnswerText(payload.text ?? '');
      if (given === '' || q.correctAnswer === null) return ZERO;
      const accepted = q.correctAnswer
        .split(',')
        .map(normalizeAnswerText)
        .filter((part) => part !== '');
      return accepted.includes(given) ? full(q) : ZERO;
    }

    case 'ESSAY':
      return (payload.text ?? '').trim() === '' ? ZERO : null;
  }
}

/**
 * (sum of earned, null counted as 0) / totalPoints * 10, 2 decimal places,
 * ROUND_HALF_UP. 0 when totalPoints is 0.
 */
export function computeScore(
  earned: (Decimal | null)[],
  totalPoints: number,
): Decimal {
  if (!(totalPoints > 0)) return ZERO;
  const sum = earned.reduce<Decimal>(
    (acc, value) => (value === null ? acc : acc.add(value)),
    ZERO,
  );
  return sum
    .div(totalPoints)
    .mul(10)
    .toDecimalPlaces(SCORE_DP, Decimal.ROUND_HALF_UP);
}
