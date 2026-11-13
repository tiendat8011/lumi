import {
  canStudentSeeResults,
  maskAttemptForStudent,
} from './result-visibility';

describe('canStudentSeeResults', () => {
  // (showResultImmediately || resultsReleased) && !hideResults
  it.each([
    // immediately, released, hideResults, visible
    [false, false, false, false],
    [false, false, true, false],
    [false, true, false, true],
    [false, true, true, false],
    [true, false, false, true],
    [true, false, true, false],
    [true, true, false, true],
    [true, true, true, false],
  ])(
    'showResultImmediately=%s resultsReleased=%s hideResults=%s -> %s',
    (showResultImmediately, resultsReleased, hideResults, visible) => {
      expect(
        canStudentSeeResults(
          { showResultImmediately, resultsReleased },
          { hideResults },
        ),
      ).toBe(visible);
    },
  );

  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
    [true, true, true],
  ])(
    'null assignment: showResultImmediately=%s resultsReleased=%s -> %s',
    (showResultImmediately, resultsReleased, visible) => {
      const exam = { showResultImmediately, resultsReleased };
      expect(canStudentSeeResults(exam, null)).toBe(visible);
      expect(canStudentSeeResults(exam, undefined)).toBe(visible);
    },
  );
});

describe('maskAttemptForStudent', () => {
  const base = {
    id: 'a1',
    status: 'SUBMITTED',
    score: '7.50',
    feedback: 'Tốt',
  };

  it('keeps score and feedback when results are visible', () => {
    const masked = maskAttemptForStudent({
      ...base,
      exam: { showResultImmediately: true, resultsReleased: false },
      assignment: { hideResults: false },
    });
    expect(masked).toMatchObject({
      id: 'a1',
      score: '7.50',
      feedback: 'Tốt',
      resultsHidden: false,
    });
  });

  it('nulls score and feedback and sets resultsHidden when the exam hides results', () => {
    const masked = maskAttemptForStudent({
      ...base,
      exam: { showResultImmediately: false, resultsReleased: false },
      assignment: null,
    });
    expect(masked.score).toBeNull();
    expect(masked.feedback).toBeNull();
    expect(masked.resultsHidden).toBe(true);
    expect(masked.id).toBe('a1');
  });

  it('nulls score and feedback when the assignment hides results, even after release', () => {
    const masked = maskAttemptForStudent({
      ...base,
      exam: { showResultImmediately: true, resultsReleased: true },
      assignment: { hideResults: true },
    });
    expect(masked.score).toBeNull();
    expect(masked.feedback).toBeNull();
    expect(masked.resultsHidden).toBe(true);
  });

  it('does not modify its argument', () => {
    const attempt = {
      ...base,
      exam: { showResultImmediately: false, resultsReleased: false },
    };
    maskAttemptForStudent(attempt);
    expect(attempt.score).toBe('7.50');
  });
});
