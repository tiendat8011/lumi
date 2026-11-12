import { createTestApp, TestApp } from './support/app';
import {
  createExamScenario,
  createStudent,
  createTeacher,
  ExamScenario,
  joinClassroom,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from './support/factories';

// Baseline for E1 start, E2 answer, E3 submit, G1 auto-grading (single-select
// MCQ), G3 score override. Every start goes through the legitimate path: the
// student is a classroom member and passes the assignment id.
// Spec: docs/features/examination/*.md, docs/features/grading/*.md
describe('attempts and grading (baseline, single-select MCQ)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await t.truncateAll();
  });

  afterAll(async () => {
    await t.close();
  });

  /** Questions as returned to the student, tolerant of where the list sits in the payload. */
  const questionsOf = (attempt: any): any[] => attempt.questions ?? attempt.exam?.questions ?? [];

  async function started(sc: ExamScenario) {
    const res = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`start attempt failed: ${res.status} ${res.raw}`);
    }
    return res.data;
  }

  describe('start (E1)', () => {
    it('creates an IN_PROGRESS attempt whose expiresAt is startedAt + durationSeconds', async () => {
      const sc = await createExamScenario(t, { exam: { durationSeconds: 900 } });
      const before = Date.now();
      const res = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      const after = Date.now();
      expect([200, 201]).toContain(res.status);
      expect(res.data.status).toBe('IN_PROGRESS');
      expect(res.data.answers).toEqual([]);

      const row = await t.prisma.examAttempt.findUnique({ where: { id: res.data.id } });
      expect(row).toMatchObject({
        examId: sc.exam.id,
        studentId: sc.student.id,
        assignmentId: sc.assignment.id,
        status: 'IN_PROGRESS',
        submittedAt: null,
        score: null,
      });
      // Server clock, not client clock.
      expect(row!.startedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(row!.startedAt.getTime()).toBeLessThanOrEqual(after + 1000);
      const windowMs = row!.expiresAt.getTime() - row!.startedAt.getTime();
      expect(Math.abs(windowMs - 900_000)).toBeLessThan(1000);
    });

    it('returns every exam question with its options', async () => {
      const sc = await createExamScenario(t, { questionCount: 3 });
      const attempt = await started(sc);
      const qs = questionsOf(attempt);
      expect(qs.map((q) => q.id).sort()).toEqual(sc.questions.map((q) => q.examQuestionId).sort());
      for (const q of qs) {
        const options = q.optionsSnapshot ?? q.options;
        expect(options).toHaveLength(4);
      }
    });

    it.todo('E1 5.11 "Happy path": the start response strips isCorrect from every option (known defect)');

    it('idempotent resume: a second start returns the same attempt, saved answers and unchanged expiresAt', async () => {
      const sc = await createExamScenario(t, { exam: { maxAttempts: 3 } });
      const first = await started(sc);
      const q = sc.questions[0];
      expect((await saveAnswer(t, sc.student, first.id, q.examQuestionId, q.correctOptionId)).status).toBeLessThan(300);

      const second = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect([200, 201]).toContain(second.status);
      expect(second.data.id).toBe(first.id);
      expect(second.data.expiresAt).toBe(first.expiresAt);
      expect(second.data.answers).toHaveLength(1);
      expect(second.data.answers[0].examQuestionId).toBe(q.examQuestionId);
      expect(
        await t.prisma.examAttempt.count({ where: { examId: sc.exam.id, studentId: sc.student.id } }),
      ).toBe(1);
    });

    it.todo(
      'E4 5.11 "Basic resume after refresh": with maxAttempts = 1 a second start returns the IN_PROGRESS attempt instead of an error (known defect)',
    );

    it('a student who already submitted with maxAttempts = 1 cannot start again; no new attempt row', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      expect((await submitAttempt(t, sc.student, attempt.id)).status).toBeLessThan(300);

      const again = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(again.status).toBeGreaterThanOrEqual(400);
      expect(again.status).toBeLessThan(500);
      expect(
        await t.prisma.examAttempt.count({ where: { examId: sc.exam.id, studentId: sc.student.id } }),
      ).toBe(1);
    });

    it.todo('E1 5.11 "Max attempts": the refusal is exactly 403 MAX_ATTEMPTS_REACHED (today it is 400 BAD_REQUEST)');

    it('boundary: with maxAttempts = 2 the second attempt is allowed and the third is refused', async () => {
      const sc = await createExamScenario(t, { exam: { maxAttempts: 2 } });
      const a1 = await started(sc);
      await submitAttempt(t, sc.student, a1.id);
      const a2 = await started(sc);
      expect(a2.id).not.toBe(a1.id);
      await submitAttempt(t, sc.student, a2.id);
      const third = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(third.status).toBeGreaterThanOrEqual(400);
      expect(third.status).toBeLessThan(500);
      expect(
        await t.prisma.examAttempt.count({ where: { examId: sc.exam.id, studentId: sc.student.id } }),
      ).toBe(2);
    });

    it('availability window: an exam that opens tomorrow or closed yesterday cannot be started', async () => {
      const day = 86_400_000;
      const future = await createExamScenario(t, {
        exam: { availableFrom: new Date(Date.now() + day).toISOString() },
      });
      const past = await createExamScenario(t, {
        exam: { availableUntil: new Date(Date.now() - day).toISOString() },
      });
      for (const sc of [future, past]) {
        const res = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(await t.prisma.examAttempt.count({ where: { examId: sc.exam.id } })).toBe(0);
      }
    });

    it('a DRAFT exam and an unknown exam cannot be started', async () => {
      const teacher = await createTeacher(t);
      const student = await createStudent(t);
      const draft = await t.post('/exams', {
        token: teacher.token,
        body: { title: 'Nhap', durationSeconds: 600 },
      });
      for (const examId of [draft.data.id, '00000000-0000-0000-0000-000000000000']) {
        const res = await startAttempt(t, student, examId);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      }
      expect(await t.prisma.examAttempt.count({ where: { studentId: student.id } })).toBe(0);
    });

    it('shuffleQuestions stores a questionOrder that is a permutation of the exam question ids', async () => {
      const sc = await createExamScenario(t, { questionCount: 5, exam: { shuffleQuestions: true } });
      const attempt = await started(sc);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      const order = row!.questionOrder as string[];
      expect([...order].sort()).toEqual(sc.questions.map((q) => q.examQuestionId).sort());
    });

    it('a teacher and an anonymous caller cannot start an attempt (403 / 401)', async () => {
      const sc = await createExamScenario(t);
      const asTeacher = await t.post('/attempts/start', {
        token: sc.teacher.token,
        body: { examId: sc.exam.id, assignmentId: sc.assignment.id },
      });
      expect(asTeacher.status).toBe(403);
      const anon = await t.post('/attempts/start', { body: { examId: sc.exam.id } });
      expect(anon.status).toBe(401);
      expect(await t.prisma.examAttempt.count({ where: { examId: sc.exam.id } })).toBe(0);
    });

    it.todo('E1 5.11 "Authorization": a student who is not a member of an assigned classroom gets 403 NOT_ASSIGNED (known defect)');
    it.todo('E1 5.3: a start without assignmentId, or with an assignment of another exam or a CLOSED assignment, is refused (known defect)');
    it.todo('E1 5.11 "Access code": a missing or wrong access code gets 403 INVALID_ACCESS_CODE; the right code starts the attempt (known defect)');
    it.todo('F4 5.11: a start after assignment.dueAt is refused (known defect)');
    it.todo('E1 5.8 "Concurrency Protection": N parallel starts by one student create exactly one ExamAttempt row (known defect)');
  });

  describe('save answer (E2)', () => {
    it('saves an answer, then updates it in place (upsert): one row, latest option', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];

      const a = await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.wrongOptionId);
      expect(a.status).toBeLessThan(300);
      const b = await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      expect(b.status).toBeLessThan(300);

      const rows = await t.prisma.answer.findMany({ where: { attemptId: attempt.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].examQuestionId).toBe(q.examQuestionId);
      expect(JSON.stringify(rows[0].answerPayload)).toContain(q.correctOptionId);
      expect(JSON.stringify(rows[0].answerPayload)).not.toContain(q.wrongOptionId);
    });

    it('idempotency: saving the same answer twice leaves exactly one row', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      for (let i = 0; i < 2; i++) {
        expect(
          (await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId)).status,
        ).toBeLessThan(300);
      }
      expect(await t.prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(1);
    });

    it('another student cannot save into the attempt (403); a teacher cannot either (403)', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      const intruder = await createStudent(t);
      await joinClassroom(t, intruder, sc.classroom.joinCode);

      expect(
        (await saveAnswer(t, intruder, attempt.id, q.examQuestionId, q.correctOptionId)).status,
      ).toBe(403);
      const asTeacher = await t.post(`/attempts/${attempt.id}/answer`, {
        token: sc.teacher.token,
        body: { examQuestionId: q.examQuestionId, selectedOptionId: q.correctOptionId },
      });
      expect(asTeacher.status).toBe(403);
      expect(await t.prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(0);
    });

    it('an answer cannot be saved after submit (400) and the score does not change', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      const submitted = await submitAttempt(t, sc.student, attempt.id);
      expect(Number(submitted.data.score)).toBe(0);

      const late = await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      expect(late.status).toBe(400);
      expect(await t.prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(0);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      expect(Number(row!.score)).toBe(0);
    });

    it('lazy expiry: a save arriving after expiresAt is not stored and the attempt is auto-submitted and graded', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const [q1, q2] = sc.questions;
      await saveAnswer(t, sc.student, attempt.id, q1.examQuestionId, q1.correctOptionId);

      // Move the server-side deadline into the past (the only way to expire without waiting).
      await t.prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const late = await saveAnswer(t, sc.student, attempt.id, q2.examQuestionId, q2.correctOptionId);
      expect(late.status).toBeGreaterThanOrEqual(400);
      expect(late.status).toBeLessThan(500);

      const row = await t.prisma.examAttempt.findUnique({
        where: { id: attempt.id },
        include: { answers: true },
      });
      expect(row!.status).not.toBe('IN_PROGRESS');
      expect(row!.submittedAt).not.toBeNull();
      expect(row!.answers).toHaveLength(1); // the late answer was not saved
      expect(Number(row!.score)).toBe(5); // 1 of 2 equal-weight questions
    });

    it.todo('E2 5.11 "Invalid question": an examQuestionId from a different exam is refused with 400 INVALID_QUESTION (defect, see report)');
    it.todo('E2 5.6: a selectedOptionId that is not an option of that question is refused (defect, see report)');
    it.todo('E2 (module E): MCQ_MULTI, TRUE_FALSE, SHORT_ANSWER, FILL_BLANK and ESSAY answer payloads are accepted and stored');
  });

  describe('submit and auto-grading (E3, G1)', () => {
    it('score = earned / total x 10 with weighted points: [2,3,2,3], answers [correct, wrong, correct, none] gives 4.00', async () => {
      const sc = await createExamScenario(t, { questionCount: 4, points: [2, 3, 2, 3] });
      const attempt = await started(sc);
      const [q1, q2, q3] = sc.questions;
      await saveAnswer(t, sc.student, attempt.id, q1.examQuestionId, q1.correctOptionId);
      await saveAnswer(t, sc.student, attempt.id, q2.examQuestionId, q2.wrongOptionId);
      await saveAnswer(t, sc.student, attempt.id, q3.examQuestionId, q3.correctOptionId);

      const before = Date.now();
      const res = await submitAttempt(t, sc.student, attempt.id);
      expect(res.status).toBeLessThan(300);
      expect(res.data.status).toBe('SUBMITTED');
      expect(Number(res.data.score)).toBe(4);

      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      expect(row!.status).toBe('SUBMITTED');
      expect(row!.score!.toFixed(2)).toBe('4.00');
      expect(row!.manualScoreOverride).toBe(false);
      expect(Math.abs(row!.submittedAt!.getTime() - before)).toBeLessThan(5000);
    });

    it('all correct gives 10.00; all wrong gives 0.00; no answers gives 0.00', async () => {
      const allRight = await createExamScenario(t, { questionCount: 3 });
      const a1 = await started(allRight);
      for (const q of allRight.questions) {
        await saveAnswer(t, allRight.student, a1.id, q.examQuestionId, q.correctOptionId);
      }
      expect(Number((await submitAttempt(t, allRight.student, a1.id)).data.score)).toBe(10);

      const allWrong = await createExamScenario(t, { questionCount: 3 });
      const a2 = await started(allWrong);
      for (const q of allWrong.questions) {
        await saveAnswer(t, allWrong.student, a2.id, q.examQuestionId, q.wrongOptionId);
      }
      expect(Number((await submitAttempt(t, allWrong.student, a2.id)).data.score)).toBe(0);

      const empty = await createExamScenario(t, { questionCount: 3 });
      const a3 = await started(empty);
      const res = await submitAttempt(t, empty.student, a3.id);
      expect(res.data.status).toBe('SUBMITTED');
      expect(Number(res.data.score)).toBe(0);
    });

    it('rounding: 1 of 3 equal questions is stored as 3.33 and 2 of 3 as 6.67', async () => {
      for (const [correctCount, expected] of [
        [1, '3.33'],
        [2, '6.67'],
      ] as const) {
        const sc = await createExamScenario(t, { questionCount: 3 });
        const attempt = await started(sc);
        for (const q of sc.questions.slice(0, correctCount)) {
          await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
        }
        await submitAttempt(t, sc.student, attempt.id);
        const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
        expect(row!.score!.toFixed(2)).toBe(expected);
      }
    });

    it('double submit: the second call succeeds with the same score, and submittedAt is unchanged', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);

      const first = await submitAttempt(t, sc.student, attempt.id);
      const rowAfterFirst = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      const second = await submitAttempt(t, sc.student, attempt.id);
      const rowAfterSecond = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });

      expect(first.status).toBeLessThan(300);
      expect(second.status).toBeLessThan(300);
      expect(Number(first.data.score)).toBe(5);
      expect(Number(second.data.score)).toBe(5);
      expect(second.data.status).toBe('SUBMITTED');
      expect(rowAfterSecond!.submittedAt).toEqual(rowAfterFirst!.submittedAt);
      expect(rowAfterSecond!.score!.toFixed(2)).toBe('5.00');
    });

    it('concurrency: five parallel submits all report the same score and leave one SUBMITTED attempt', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => submitAttempt(t, sc.student, attempt.id)),
      );
      for (const r of results) {
        expect(r.status).toBeLessThan(300);
        expect(Number(r.data.score)).toBe(5);
      }
      const rows = await t.prisma.examAttempt.findMany({
        where: { examId: sc.exam.id, studentId: sc.student.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('SUBMITTED');
      expect(rows[0].score!.toFixed(2)).toBe('5.00');
    });

    it.todo(
      'E3 5.11 "Concurrent submit protection": exactly one grading operation occurs under parallel submits (needs an observable: submittedAt identical in all responses, or a grading audit row)',
    );

    it("another student cannot submit the attempt (403) and it stays IN_PROGRESS", async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const intruder = await createStudent(t);
      expect((await submitAttempt(t, intruder, attempt.id)).status).toBe(403);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      expect(row!.status).toBe('IN_PROGRESS');
    });

    it('submitting an unknown attempt returns 404', async () => {
      const student = await createStudent(t);
      const res = await t.post('/attempts/00000000-0000-0000-0000-000000000000/submit', {
        token: student.token,
      });
      expect(res.status).toBe(404);
    });

    it('lazy expiry on read: GET /attempts/:id after expiresAt returns the attempt already submitted and graded', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      await t.prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await t.get(`/attempts/${attempt.id}`, { token: sc.student.token });
      expect(res.status).toBe(200);
      expect(res.data.status).not.toBe('IN_PROGRESS');
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      expect(row!.submittedAt).not.toBeNull();
      expect(row!.score!.toFixed(2)).toBe('5.00');
    });

    it("another student cannot read the attempt (403)", async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const intruder = await createStudent(t);
      expect((await t.get(`/attempts/${attempt.id}`, { token: intruder.token })).status).toBe(403);
    });

    it.todo('G2 5.11 negative (known defect): GET /attempts/:id/result is refused (403) for another student and for a teacher who does not own the exam');
    it.todo('G1 (module G): MCQ_MULTI, SHORT_ANSWER and FILL_BLANK answers are auto-graded; ESSAY is left for manual grading');
  });

  describe('teacher views and score override (G2, G3)', () => {
    async function submittedScenario() {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      await submitAttempt(t, sc.student, attempt.id);
      return { sc, attemptId: attempt.id as string };
    }

    it('the exam owner lists attempts with student name and score; another teacher gets 403', async () => {
      const { sc, attemptId } = await submittedScenario();
      const res = await t.get('/attempts', { token: sc.teacher.token, query: { examId: sc.exam.id } });
      expect(res.status).toBe(200);
      expect(res.data).toHaveLength(1);
      expect(res.data[0]).toMatchObject({ id: attemptId, status: 'SUBMITTED' });
      expect(Number(res.data[0].score)).toBe(5);
      expect(res.data[0].student).toMatchObject({
        id: sc.student.id,
        displayName: sc.student.displayName,
      });

      const other = await createTeacher(t);
      expect(
        (await t.get('/attempts', { token: other.token, query: { examId: sc.exam.id } })).status,
      ).toBe(403);
    });

    it('review: the student sees their own selection and the correct answer; another student gets 403', async () => {
      const { sc, attemptId } = await submittedScenario();
      const res = await t.get(`/attempts/${attemptId}/review`, { token: sc.student.token });
      expect(res.status).toBe(200);
      const items: any[] = Array.isArray(res.data) ? res.data : res.data.questions;
      expect(items).toHaveLength(2);
      const first = items.find((r: any) => r.position === 0);
      expect(first.selectedOptionId).toBe(sc.questions[0].correctOptionId);
      expect(first.isCorrect).toBe(true);

      const intruder = await createStudent(t);
      expect((await t.get(`/attempts/${attemptId}/review`, { token: intruder.token })).status).toBe(403);
      const otherTeacher = await createTeacher(t);
      expect((await t.get(`/attempts/${attemptId}/review`, { token: otherTeacher.token })).status).toBe(403);
    });

    it('result visibility (G5): with showResultImmediately = false and results not released, the student cannot open the review', async () => {
      const sc = await createExamScenario(t, { exam: { showResultImmediately: false } });
      const attempt = await started(sc);
      await submitAttempt(t, sc.student, attempt.id);

      const hidden = await t.get(`/attempts/${attempt.id}/review`, { token: sc.student.token });
      expect(hidden.status).toBeGreaterThanOrEqual(400);
      expect(hidden.status).toBeLessThan(500);

      const release = await t.patch(`/exams/${sc.exam.id}/release-results`, {
        token: sc.teacher.token,
        body: { release: true },
      });
      expect(release.status).toBe(200);
      const shown = await t.get(`/attempts/${attempt.id}/review`, { token: sc.student.token });
      expect(shown.status).toBe(200);
    });

    it.todo('G5 5.11 (defect, see report): with results hidden, POST /attempts/:id/submit, GET /attempts/:id, GET /attempts/my and GET /attempts/:id/result do not return the score to the student');

    it('the exam owner overrides the score: stored value and manualScoreOverride = true', async () => {
      const { sc, attemptId } = await submittedScenario();
      const res = await t.patch(`/attempts/${attemptId}/score`, {
        token: sc.teacher.token,
        body: { score: 8 },
      });
      expect(res.status).toBe(200);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attemptId } });
      expect(row!.score!.toFixed(2)).toBe('8.00');
      expect(row!.manualScoreOverride).toBe(true);
    });

    it('boundary: 0 and 10 are valid manual scores; -0.01, 10.01 and 15 are rejected (400) and change nothing', async () => {
      const { sc, attemptId } = await submittedScenario();
      const patch = (score: unknown) =>
        t.patch(`/attempts/${attemptId}/score`, { token: sc.teacher.token, body: { score } });

      expect((await patch(0)).status).toBe(200);
      expect((await t.prisma.examAttempt.findUnique({ where: { id: attemptId } }))!.score!.toFixed(2)).toBe('0.00');
      expect((await patch(10)).status).toBe(200);
      for (const bad of [-0.01, 10.01, 15, 'abc', null]) {
        expect((await patch(bad)).status).toBe(400);
      }
      expect((await t.prisma.examAttempt.findUnique({ where: { id: attemptId } }))!.score!.toFixed(2)).toBe('10.00');
    });

    it('a teacher who does not own the exam and a student cannot override (403); the score is unchanged', async () => {
      const { sc, attemptId } = await submittedScenario();
      const other = await createTeacher(t);
      expect(
        (await t.patch(`/attempts/${attemptId}/score`, { token: other.token, body: { score: 10 } })).status,
      ).toBe(403);
      expect(
        (await t.patch(`/attempts/${attemptId}/score`, { token: sc.student.token, body: { score: 10 } })).status,
      ).toBe(403);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attemptId } });
      expect(row!.score!.toFixed(2)).toBe('5.00');
      expect(row!.manualScoreOverride).toBe(false);
    });

    it('regrade leaves a manually overridden attempt untouched and recomputes the others', async () => {
      const sc = await createExamScenario(t);
      const second = await createStudent(t);
      await joinClassroom(t, second, sc.classroom.joinCode);
      const q = sc.questions[0];

      const a1 = await started(sc);
      await saveAnswer(t, sc.student, a1.id, q.examQuestionId, q.correctOptionId);
      await submitAttempt(t, sc.student, a1.id);

      const start2 = await startAttempt(t, second, sc.exam.id, sc.assignment.id);
      await saveAnswer(t, second, start2.data.id, q.examQuestionId, q.correctOptionId);
      await submitAttempt(t, second, start2.data.id);

      await t.patch(`/attempts/${a1.id}/score`, { token: sc.teacher.token, body: { score: 9.5 } });
      // Corrupt the auto-graded score so a real recomputation is observable.
      await t.prisma.examAttempt.update({ where: { id: start2.data.id }, data: { score: 1 } });

      const res = await t.post(`/exams/${sc.exam.id}/regrade`, { token: sc.teacher.token });
      expect(res.status).toBe(200);
      expect(res.data.regraded).toBe(1);

      const overridden = await t.prisma.examAttempt.findUnique({ where: { id: a1.id } });
      const regraded = await t.prisma.examAttempt.findUnique({ where: { id: start2.data.id } });
      expect(overridden!.score!.toFixed(2)).toBe('9.50');
      expect(overridden!.manualScoreOverride).toBe(true);
      expect(regraded!.score!.toFixed(2)).toBe('5.00');
    });

    it("regrade: another teacher gets 403; an exam with no submitted attempts reports 0", async () => {
      const sc = await createExamScenario(t);
      const other = await createTeacher(t);
      expect((await t.post(`/exams/${sc.exam.id}/regrade`, { token: other.token })).status).toBe(403);
      const res = await t.post(`/exams/${sc.exam.id}/regrade`, { token: sc.teacher.token });
      expect(res.status).toBe(200);
      expect(res.data.regraded).toBe(0);
    });

    it.todo('G3 5.11 negative (defect, see report): PATCH /attempts/:id/score on an IN_PROGRESS attempt is rejected with 400');
  });
});
