import { createHash } from 'crypto';
import {
  QuestionType,
  SnapshotOption,
  parseOptionsSnapshot,
  resolveType,
  snapshotOf,
} from './grading-engine';

/** The exam_questions columns the student view is built from. */
export type ExamQuestionRow = {
  id: string;
  points: number;
  position: number;
  contentSnapshot: string | null;
  optionsSnapshot: unknown;
  typeSnapshot: string | null;
  correctAnswerSnapshot: string | null;
  imageUrlSnapshot: string | null;
};

export type StudentQuestion = {
  id: string;
  position: number;
  points: number;
  questionType: QuestionType;
  content: string | null;
  imageUrl: string | null;
  /** Null for question types without options. Never carries isCorrect. */
  options: { id: string; content: string }[] | null;
};

const OPTION_TYPES: QuestionType[] = ['MCQ', 'MCQ_MULTI', 'TRUE_FALSE'];
const SHUFFLED_TYPES: QuestionType[] = ['MCQ', 'MCQ_MULTI'];

function shuffleKey(attemptId: string, optionId: string): string {
  return createHash('sha256').update(`${attemptId}:${optionId}`).digest('hex');
}

/**
 * Options in the order one attempt sees them. With shuffle on, MCQ and
 * MCQ_MULTI options are sorted by sha256(attemptId:optionId): stable across
 * resume, refresh and tabs, different between attempts. TRUE_FALSE keeps the
 * authored order.
 */
export function orderOptionsForAttempt(
  options: SnapshotOption[],
  type: QuestionType,
  attemptId: string,
  shuffleOptions: boolean,
): SnapshotOption[] {
  const authored = [...options].sort((a, b) => a.position - b.position);
  if (!shuffleOptions || !SHUFFLED_TYPES.includes(type)) return authored;
  return authored
    .map((option) => ({ option, key: shuffleKey(attemptId, option.id) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.option);
}

/**
 * The only serializer for a question shown to a student during an attempt.
 * It builds a new object from an allow-list of fields, so isCorrect, the
 * answer key and the explanation cannot leak by being added to the row.
 */
export function toStudentQuestion(
  eq: ExamQuestionRow,
  attemptId: string,
  shuffleOptions: boolean,
): StudentQuestion {
  const type = resolveType(snapshotOf(eq));
  const options = parseOptionsSnapshot(eq.optionsSnapshot);
  const visibleOptions =
    options && OPTION_TYPES.includes(type)
      ? orderOptionsForAttempt(options, type, attemptId, shuffleOptions).map(
          (o) => ({ id: o.id, content: o.content }),
        )
      : null;

  return {
    id: eq.id,
    position: eq.position,
    points: eq.points,
    questionType: type,
    content: eq.contentSnapshot,
    imageUrl: eq.imageUrlSnapshot,
    options: visibleOptions,
  };
}

/**
 * Questions in display order for one attempt: the stored questionOrder when
 * the exam shuffles questions, otherwise by position. Ids missing from the
 * stored order are appended by position.
 */
export function orderQuestionsForAttempt<
  T extends { id: string; position: number },
>(questions: T[], questionOrder: unknown): T[] {
  const byPosition = [...questions].sort((a, b) => a.position - b.position);
  if (!Array.isArray(questionOrder)) return byPosition;
  const byId = new Map(byPosition.map((q) => [q.id, q]));
  const ordered: T[] = [];
  for (const id of questionOrder) {
    const q = typeof id === 'string' ? byId.get(id) : undefined;
    if (q) {
      ordered.push(q);
      byId.delete(id as string);
    }
  }
  return [...ordered, ...byId.values()];
}
