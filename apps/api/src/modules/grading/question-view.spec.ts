import {
  ExamQuestionRow,
  orderQuestionsForAttempt,
  toStudentQuestion,
} from './question-view';

const ATTEMPT_1 = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_2 = '22222222-2222-4222-8222-222222222222';

function optionRow(
  type: string | null,
  optionCount: number,
  correct: number[] = [0],
): ExamQuestionRow & { explanationSnapshot: string } {
  return {
    id: 'eq-1',
    points: 2,
    position: 3,
    contentSnapshot: 'Nội dung câu hỏi',
    typeSnapshot: type,
    optionsSnapshot: Array.from({ length: optionCount }, (_, i) => ({
      id: `option-${i}`,
      content: `Đáp án ${i}`,
      isCorrect: correct.includes(i),
      position: i,
    })),
    correctAnswerSnapshot: 'bí mật',
    imageUrlSnapshot: '/uploads/images/x.png',
    audioUrlSnapshot: null,
    passageSnapshot: null,
    explanationSnapshot: 'Giải thích bí mật',
  };
}

const ids = (q: { options: { id: string }[] | null }) =>
  (q.options ?? []).map((o) => o.id);

describe('toStudentQuestion', () => {
  it('returns only the allow-listed fields', () => {
    const view = toStudentQuestion(optionRow('MCQ', 4), ATTEMPT_1, false);
    expect(Object.keys(view).sort()).toEqual(
      [
        'audioUrl',
        'content',
        'id',
        'imageUrl',
        'options',
        'passage',
        'points',
        'position',
        'questionType',
      ].sort(),
    );
    expect(view).toMatchObject({
      id: 'eq-1',
      position: 3,
      points: 2,
      questionType: 'MCQ',
      content: 'Nội dung câu hỏi',
      imageUrl: '/uploads/images/x.png',
    });
    for (const option of view.options!) {
      expect(Object.keys(option).sort()).toEqual(['content', 'id']);
    }
  });

  it.each([true, false])(
    'never exposes isCorrect, correctAnswer or explanation (shuffle=%s)',
    (shuffle) => {
      for (const row of [
        optionRow('MCQ', 4),
        optionRow('MCQ_MULTI', 4, [0, 2]),
        optionRow('TRUE_FALSE', 2),
        optionRow(null, 4),
        { ...optionRow('SHORT_ANSWER', 0), optionsSnapshot: null },
        { ...optionRow('ESSAY', 0), optionsSnapshot: null },
      ]) {
        const json = JSON.stringify(toStudentQuestion(row, ATTEMPT_1, shuffle));
        expect(json).not.toContain('isCorrect');
        expect(json).not.toContain('correctAnswer');
        expect(json).not.toContain('explanation');
        expect(json).not.toContain('bí mật');
      }
    },
  );

  it('gives null options to question types without options', () => {
    const short = toStudentQuestion(
      { ...optionRow('SHORT_ANSWER', 0), optionsSnapshot: null },
      ATTEMPT_1,
      true,
    );
    expect(short.questionType).toBe('SHORT_ANSWER');
    expect(short.options).toBeNull();
  });

  it('infers the type of a legacy snapshot', () => {
    expect(
      toStudentQuestion(optionRow(null, 4, [1]), ATTEMPT_1, false).questionType,
    ).toBe('MCQ');
    expect(
      toStudentQuestion(optionRow(null, 4, [1, 2]), ATTEMPT_1, false)
        .questionType,
    ).toBe('MCQ_MULTI');
  });

  it('keeps the authored order when shuffle is off', () => {
    const row = optionRow('MCQ', 6);
    // Stored out of order on purpose: the view sorts by position.
    (row.optionsSnapshot as unknown[]).reverse();
    expect(ids(toStudentQuestion(row, ATTEMPT_1, false))).toEqual([
      'option-0',
      'option-1',
      'option-2',
      'option-3',
      'option-4',
      'option-5',
    ]);
  });

  it.each(['MCQ', 'MCQ_MULTI'])(
    '%s: the shuffled order is identical for the same attempt id',
    (type) => {
      const row = optionRow(type, 8, [0, 1]);
      const first = ids(toStudentQuestion(row, ATTEMPT_1, true));
      const second = ids(toStudentQuestion(row, ATTEMPT_1, true));
      expect(second).toEqual(first);
      expect([...first].sort()).toEqual(
        Array.from({ length: 8 }, (_, i) => `option-${i}`).sort(),
      );
    },
  );

  it.each(['MCQ', 'MCQ_MULTI'])(
    '%s: the shuffled order differs between attempt ids and from the authored order',
    (type) => {
      const row = optionRow(type, 8, [0, 1]);
      const authored = ids(toStudentQuestion(row, ATTEMPT_1, false));
      const one = ids(toStudentQuestion(row, ATTEMPT_1, true));
      const two = ids(toStudentQuestion(row, ATTEMPT_2, true));
      expect(one).not.toEqual(two);
      expect(one).not.toEqual(authored);
      expect(two).not.toEqual(authored);
    },
  );

  it('TRUE_FALSE is never shuffled', () => {
    const row = optionRow('TRUE_FALSE', 2);
    for (let i = 0; i < 20; i++) {
      const attemptId = `attempt-${i}`;
      expect(ids(toStudentQuestion(row, attemptId, true))).toEqual([
        'option-0',
        'option-1',
      ]);
    }
  });
});

describe('orderQuestionsForAttempt', () => {
  const questions = [
    { id: 'c', position: 2 },
    { id: 'a', position: 0 },
    { id: 'b', position: 1 },
  ];

  it('orders by position when there is no stored order', () => {
    expect(orderQuestionsForAttempt(questions, null).map((q) => q.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('follows the stored order', () => {
    expect(
      orderQuestionsForAttempt(questions, ['b', 'c', 'a']).map((q) => q.id),
    ).toEqual(['b', 'c', 'a']);
  });

  it('ignores unknown ids and appends questions missing from the stored order', () => {
    expect(
      orderQuestionsForAttempt(questions, ['c', 'zzz']).map((q) => q.id),
    ).toEqual(['c', 'a', 'b']);
  });
});
