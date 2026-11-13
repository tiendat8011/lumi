import {
  AnswerPayload,
  Decimal,
  GradingMode,
  QuestionType,
  SnapshotQuestion,
  computeScore,
  gradeAnswer,
  parseAnswerPayload,
  parseOptionsSnapshot,
  resolveType,
  snapshotOf,
} from './grading-engine';

const A = 'opt-a';
const B = 'opt-b';
const C = 'opt-c';
const D = 'opt-d';

function optionQuestion(
  type: QuestionType | null,
  correct: string[],
  points = 2,
  ids = [A, B, C, D],
): SnapshotQuestion {
  return {
    id: 'q1',
    points,
    type,
    options: ids.map((id) => ({ id, isCorrect: correct.includes(id) })),
    correctAnswer: null,
  };
}

function textQuestion(
  type: QuestionType | null,
  correctAnswer: string | null,
  points = 2,
): SnapshotQuestion {
  return { id: 'q1', points, type, options: null, correctAnswer };
}

function grade(
  q: SnapshotQuestion,
  payload: AnswerPayload | null,
  mode: GradingMode = 'ALL_OR_NOTHING',
): string | null {
  const result = gradeAnswer(q, payload, mode);
  return result === null ? null : result.toFixed(4);
}

describe('gradeAnswer', () => {
  describe.each(['MCQ', 'TRUE_FALSE'] as const)('%s', (type) => {
    const q =
      type === 'MCQ'
        ? optionQuestion(type, [B])
        : optionQuestion(type, [A], 2, [A, B]);
    const right = type === 'MCQ' ? B : A;
    const wrong = type === 'MCQ' ? A : B;

    it('gives full points for the correct option', () => {
      expect(grade(q, { selectedOptionId: right })).toBe('2.0000');
    });

    it('gives 0 for a wrong option', () => {
      expect(grade(q, { selectedOptionId: wrong })).toBe('0.0000');
    });

    it('gives 0 for an option id that is not in the snapshot', () => {
      expect(grade(q, { selectedOptionId: 'unknown' })).toBe('0.0000');
    });

    it('is not affected by the grading mode', () => {
      expect(grade(q, { selectedOptionId: right }, 'PARTIAL')).toBe('2.0000');
      expect(grade(q, { selectedOptionId: wrong }, 'PARTIAL')).toBe('0.0000');
    });

    it('gives 0 when two options are sent for a single-select question', () => {
      expect(grade(q, { selectedOptionIds: [right, wrong] })).toBe('0.0000');
    });
  });

  describe('MCQ_MULTI, ALL_OR_NOTHING', () => {
    const q = optionQuestion('MCQ_MULTI', [A, C], 4);

    it('gives full points when the selected set equals the correct set', () => {
      expect(grade(q, { selectedOptionIds: [C, A] })).toBe('4.0000');
    });

    it('ignores duplicate ids in the selection', () => {
      expect(grade(q, { selectedOptionIds: [A, C, A] })).toBe('4.0000');
    });

    it('gives 0 for a subset of the correct set', () => {
      expect(grade(q, { selectedOptionIds: [A] })).toBe('0.0000');
    });

    it('gives 0 for the correct set plus a wrong option', () => {
      expect(grade(q, { selectedOptionIds: [A, B, C] })).toBe('0.0000');
    });

    it('gives 0 for an empty selection', () => {
      expect(grade(q, { selectedOptionIds: [] })).toBe('0.0000');
    });
  });

  describe('MCQ_MULTI, PARTIAL (ruling D5)', () => {
    // max(0, correctSelected - incorrectSelected) / totalCorrect * points
    const q = optionQuestion('MCQ_MULTI', [A, B, C], 3);

    it.each([
      [[A, B, C], '3.0000'], // 3 - 0 = 3 of 3
      [[A, B], '2.0000'], // 2 - 0 = 2 of 3
      [[A], '1.0000'], // 1 of 3
      [[A, B, D], '1.0000'], // 2 - 1 = 1 of 3
      [[A, B, C, D], '2.0000'], // 3 - 1 = 2 of 3
      [[A, D], '0.0000'], // 1 - 1 = 0
      [[D], '0.0000'], // 0 - 1, floored at 0
      [[], '0.0000'],
    ])('selection %j earns %s', (selection, expected) => {
      expect(grade(q, { selectedOptionIds: selection }, 'PARTIAL')).toBe(
        expected,
      );
    });

    it('floors the penalty at 0: more wrong than right never goes negative', () => {
      const two = optionQuestion('MCQ_MULTI', [A, B], 2);
      expect(grade(two, { selectedOptionIds: [A, C, D] }, 'PARTIAL')).toBe(
        '0.0000',
      );
    });

    it('counts an id that is not in the snapshot as an incorrect selection', () => {
      expect(
        grade(q, { selectedOptionIds: [A, B, 'unknown'] }, 'PARTIAL'),
      ).toBe('1.0000');
    });

    it('keeps 4 decimal places, ROUND_HALF_UP: 1 of 3 correct on 1 point is 0.3333, 2 of 3 is 0.6667', () => {
      const one = optionQuestion('MCQ_MULTI', [A, B, C], 1);
      expect(grade(one, { selectedOptionIds: [A] }, 'PARTIAL')).toBe('0.3333');
      expect(grade(one, { selectedOptionIds: [A, B] }, 'PARTIAL')).toBe(
        '0.6667',
      );
    });

    it('gives 0 when the snapshot has no correct option', () => {
      const none = optionQuestion('MCQ_MULTI', [], 3);
      expect(grade(none, { selectedOptionIds: [A] }, 'PARTIAL')).toBe('0.0000');
      expect(grade(none, { selectedOptionIds: [A] })).toBe('0.0000');
    });
  });

  describe('MCQ_MULTI with a legacy {selectedOptionId} payload', () => {
    it('is treated as a one-element selection', () => {
      const single = optionQuestion('MCQ_MULTI', [A], 2);
      expect(grade(single, { selectedOptionId: A })).toBe('2.0000');

      const multi = optionQuestion('MCQ_MULTI', [A, B], 2);
      expect(grade(multi, { selectedOptionId: A })).toBe('0.0000');
      expect(grade(multi, { selectedOptionId: A }, 'PARTIAL')).toBe('1.0000');
    });
  });

  describe.each(['SHORT_ANSWER', 'FILL_BLANK'] as const)('%s', (type) => {
    it('gives full points for an exact match and 0 otherwise', () => {
      const q = textQuestion(type, 'Hà Nội');
      expect(grade(q, { text: 'Hà Nội' })).toBe('2.0000');
      expect(grade(q, { text: 'Huế' })).toBe('0.0000');
    });

    it('ignores case', () => {
      expect(grade(textQuestion(type, 'Hà Nội'), { text: 'hà nội' })).toBe(
        '2.0000',
      );
      expect(grade(textQuestion(type, 'paris'), { text: 'PARIS' })).toBe(
        '2.0000',
      );
    });

    it('trims and collapses inner whitespace', () => {
      expect(
        grade(textQuestion(type, 'Hà Nội'), { text: '  Hà \t  Nội \n' }),
      ).toBe('2.0000');
      expect(grade(textQuestion(type, ' Hà   Nội '), { text: 'Hà Nội' })).toBe(
        '2.0000',
      );
    });

    it('compares in Unicode NFC: a decomposed answer matches a composed key', () => {
      const composed = 'Hà Nội'.normalize('NFC');
      const decomposed = 'Hà Nội'.normalize('NFD');
      expect(composed).not.toBe(decomposed);
      expect(grade(textQuestion(type, composed), { text: decomposed })).toBe(
        '2.0000',
      );
      expect(grade(textQuestion(type, decomposed), { text: composed })).toBe(
        '2.0000',
      );
    });

    it('accepts any of the comma-separated alternatives', () => {
      const q = textQuestion(type, 'Hà Nội, Ha Noi ,hanoi');
      expect(grade(q, { text: 'ha noi' })).toBe('2.0000');
      expect(grade(q, { text: 'HANOI' })).toBe('2.0000');
      expect(grade(q, { text: 'Hà Nội' })).toBe('2.0000');
      expect(grade(q, { text: 'Hà Nội, Ha Noi' })).toBe('0.0000');
    });

    it('does not treat diacritics as optional', () => {
      expect(grade(textQuestion(type, 'Hà Nội'), { text: 'Ha Noi' })).toBe(
        '0.0000',
      );
    });

    it('gives 0 for a blank answer, even when the key has an empty alternative', () => {
      expect(grade(textQuestion(type, 'a,,b'), { text: '   ' })).toBe('0.0000');
      expect(grade(textQuestion(type, 'a'), { text: '' })).toBe('0.0000');
    });

    it('gives 0 when the snapshot has no answer key', () => {
      expect(grade(textQuestion(type, null), { text: 'a' })).toBe('0.0000');
    });
  });

  describe('ESSAY', () => {
    const q = textQuestion('ESSAY', null, 5);

    it('returns null (needs a human) for a non-empty text', () => {
      expect(gradeAnswer(q, { text: 'Bài làm' }, 'ALL_OR_NOTHING')).toBeNull();
      expect(gradeAnswer(q, { text: 'Bài làm' }, 'PARTIAL')).toBeNull();
    });

    it('returns 0, not null, for a blank text', () => {
      expect(grade(q, { text: '' })).toBe('0.0000');
      expect(grade(q, { text: '  \n ' })).toBe('0.0000');
    });

    it('returns 0 for no answer and for an empty payload', () => {
      expect(grade(q, null)).toBe('0.0000');
      expect(grade(q, {})).toBe('0.0000');
    });
  });

  describe('no answer row, or an empty payload', () => {
    const cases: [string, SnapshotQuestion][] = [
      ['MCQ', optionQuestion('MCQ', [A])],
      ['TRUE_FALSE', optionQuestion('TRUE_FALSE', [A], 2, [A, B])],
      ['MCQ_MULTI', optionQuestion('MCQ_MULTI', [A, B])],
      ['SHORT_ANSWER', textQuestion('SHORT_ANSWER', 'x')],
      ['FILL_BLANK', textQuestion('FILL_BLANK', 'x')],
      ['ESSAY', textQuestion('ESSAY', null)],
    ];

    it.each(cases)('%s earns 0', (_name, q) => {
      for (const mode of ['ALL_OR_NOTHING', 'PARTIAL'] as const) {
        expect(grade(q, null, mode)).toBe('0.0000');
        expect(grade(q, {}, mode)).toBe('0.0000');
      }
    });
  });

  describe('legacy snapshot with type NULL', () => {
    it('infers MCQ when options exist with one correct option', () => {
      const q = optionQuestion(null, [B]);
      expect(resolveType(q)).toBe('MCQ');
      expect(grade(q, { selectedOptionId: B })).toBe('2.0000');
      expect(grade(q, { selectedOptionId: A })).toBe('0.0000');
    });

    it('infers MCQ_MULTI when more than one option is correct', () => {
      const q = optionQuestion(null, [A, B]);
      expect(resolveType(q)).toBe('MCQ_MULTI');
      expect(grade(q, { selectedOptionIds: [A, B] })).toBe('2.0000');
      // The legacy single-id payload cannot equal a two-element correct set.
      expect(grade(q, { selectedOptionId: A })).toBe('0.0000');
    });

    it('infers SHORT_ANSWER when there are no options but an answer key', () => {
      const q = textQuestion(null, 'x');
      expect(resolveType(q)).toBe('SHORT_ANSWER');
      expect(resolveType({ ...q, options: [] })).toBe('SHORT_ANSWER');
      expect(grade(q, { text: 'X' })).toBe('2.0000');
    });

    it('infers ESSAY when there are neither options nor an answer key', () => {
      const q = textQuestion(null, null);
      expect(resolveType(q)).toBe('ESSAY');
      expect(resolveType({ ...q, correctAnswer: '  ' })).toBe('ESSAY');
      expect(gradeAnswer(q, { text: 'abc' }, 'ALL_OR_NOTHING')).toBeNull();
    });

    it('does not infer when the type is present', () => {
      expect(resolveType(optionQuestion('MCQ', [A, B]))).toBe('MCQ');
    });
  });
});

describe('computeScore', () => {
  const d = (v: string | number) => new Decimal(v);

  it('is sum / totalPoints * 10', () => {
    expect(computeScore([d(2), d(0), d(2)], 10).toFixed(2)).toBe('4.00');
    expect(computeScore([d(3), d(3), d(4)], 10).toFixed(2)).toBe('10.00');
  });

  it('rounds to 2 decimal places, ROUND_HALF_UP: 7/9 is 7.78', () => {
    expect(computeScore([d(7)], 9).toFixed(2)).toBe('7.78');
  });

  it('rounds a half up: 1.005 is 1.01, 0.045 is 0.05, 0.044 is 0.04', () => {
    expect(computeScore([d('1.005')], 10).toFixed(2)).toBe('1.01');
    expect(computeScore([d('0.0045')], 1).toFixed(2)).toBe('0.05');
    expect(computeScore([d('0.0044')], 1).toFixed(2)).toBe('0.04');
  });

  it('returns 0 when totalPoints is 0', () => {
    expect(computeScore([], 0).toFixed(2)).toBe('0.00');
    expect(computeScore([d(1)], 0).toFixed(2)).toBe('0.00');
  });

  it('computes from the stored 4-decimal values: three answers of 0.3333 on 3 points is 3.33', () => {
    expect(
      computeScore([d('0.3333'), d('0.3333'), d('0.3333')], 3).toFixed(2),
    ).toBe('3.33');
  });

  it('counts null (ungraded) as 0', () => {
    expect(computeScore([d(1), null, null], 4).toFixed(2)).toBe('2.50');
    expect(computeScore([null], 4).toFixed(2)).toBe('0.00');
  });

  it('1 of 3 and 2 of 3 equal questions are 3.33 and 6.67', () => {
    expect(computeScore([d(1)], 3).toFixed(2)).toBe('3.33');
    expect(computeScore([d(1), d(1)], 3).toFixed(2)).toBe('6.67');
  });
});

describe('snapshot and payload parsing', () => {
  it('snapshotOf reads the snapshot columns and drops an unknown type', () => {
    const q = snapshotOf({
      id: 'q',
      points: 3,
      typeSnapshot: 'SOMETHING_ELSE',
      optionsSnapshot: [
        { id: A, content: 'A', isCorrect: true, position: 0 },
        { id: B, content: 'B', isCorrect: 'yes', position: 1 },
        'junk',
        { content: 'no id' },
      ],
      correctAnswerSnapshot: null,
    });
    expect(q.type).toBeNull();
    expect(q.options).toEqual([
      { id: A, content: 'A', isCorrect: true, position: 0 },
      { id: B, content: 'B', isCorrect: false, position: 1 },
    ]);
  });

  it('parseOptionsSnapshot returns null for anything but an array', () => {
    expect(parseOptionsSnapshot(null)).toBeNull();
    expect(parseOptionsSnapshot({})).toBeNull();
    expect(parseOptionsSnapshot([])).toEqual([]);
  });

  it('parseAnswerPayload keeps only well-typed fields', () => {
    expect(parseAnswerPayload(null)).toBeNull();
    expect(parseAnswerPayload('x')).toBeNull();
    expect(parseAnswerPayload({})).toEqual({});
    expect(
      parseAnswerPayload({
        selectedOptionId: 5,
        selectedOptionIds: [A, 1, B],
        text: 'abc',
        other: true,
      }),
    ).toEqual({ selectedOptionIds: [A, B], text: 'abc' });
  });
});
