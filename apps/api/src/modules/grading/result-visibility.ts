/**
 * The single rule for whether a STUDENT may see a score, feedback, earned
 * points or an answer key. Every student-facing endpoint that returns one of
 * those calls a function in this file.
 */
export type VisibilityExam = {
  showResultImmediately: boolean;
  resultsReleased: boolean;
};
export type VisibilityAssignment = { hideResults: boolean } | null | undefined;

export function canStudentSeeResults(
  exam: VisibilityExam,
  assignment: VisibilityAssignment,
): boolean {
  return (
    (exam.showResultImmediately || exam.resultsReleased) &&
    !assignment?.hideResults
  );
}

export type MaskableAttempt = {
  score: unknown;
  feedback: string | null;
  exam: VisibilityExam;
  assignment?: VisibilityAssignment;
};

export type MaskedAttempt<T extends MaskableAttempt> = Omit<
  T,
  'score' | 'feedback'
> & {
  score: T['score'] | null;
  feedback: string | null;
  resultsHidden: boolean;
};

/**
 * Returns the attempt as a student may see it: when results are not
 * visible, score and feedback are null and resultsHidden is true.
 */
export function maskAttemptForStudent<T extends MaskableAttempt>(
  attempt: T,
): MaskedAttempt<T> {
  const visible = canStudentSeeResults(attempt.exam, attempt.assignment);
  return {
    ...attempt,
    score: visible ? attempt.score : null,
    feedback: visible ? attempt.feedback : null,
    resultsHidden: !visible,
  };
}
