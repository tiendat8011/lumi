import { createTestApp, TestApp } from './support/app';
import {
  createExamScenario,
  createMixedScenario,
  createStudent,
  createTeacher,
  ExamScenario,
  joinClassroom,
  saveAnswer,
  saveAnswerBody,
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


    it('E1 5.11 "Happy path": start and GET return top-level questions with no isCorrect, answer key or explanation', async () => {
      const sc = await createMixedScenario(t);
      const res = await startAttempt(t, sc.student, sc.examId, sc.assignment.id);
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        status: 'IN_PROGRESS',
        assignmentId: sc.assignment.id,
        exam: { durationSeconds: 600, allowFileSubmission: false },
        answers: [],
      });
      expect(typeof res.data.serverTime).toBe('string');
      expect(res.data.exam.questions).toBeUndefined();
      expect(res.data.questions).toHaveLength(6);

      const get = await t.get(`/attempts/${res.data.id}`, { token: sc.student.token });
      expect(get.status).toBe(200);
      expect(get.data.questions).toEqual(res.data.questions);

      for (const body of [res.raw, get.raw]) {
        expect(body).not.toContain('isCorrect');
        expect(body).not.toContain('correctAnswer');
        expect(body).not.toContain('explanation');
        expect(body).not.toContain('optionsSnapshot');
        expect(body).not.toContain('Giai thich bi mat'); // the explanation text
        expect(body).not.toContain('Ha Noi'); // the answer key
      }

      const byId = (id: string) => res.data.questions.find((q: any) => q.id === id);
      expect(byId(sc.mcq.eqId).questionType).toBe('MCQ');
      expect(byId(sc.mcq.eqId).options).toHaveLength(4);
      expect(Object.keys(byId(sc.mcq.eqId).options[0]).sort()).toEqual(['content', 'id']);
      expect(byId(sc.multi.eqId).questionType).toBe('MCQ_MULTI');
      expect(byId(sc.trueFalse.eqId).options).toHaveLength(2);
      expect(byId(sc.short.eqId).options).toBeNull();
      expect(byId(sc.essay.eqId)).toMatchObject({ questionType: 'ESSAY', options: null });
    });

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


    it('E4 5.11 "Basic resume after refresh": with maxAttempts = 1 the first start is 201 and the second returns the same attempt with 200', async () => {
      const sc = await createExamScenario(t); // maxAttempts defaults to 1
      const first = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(first.status).toBe(201);
      const second = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(second.status).toBe(200);
      expect(second.data.id).toBe(first.data.id);
      expect(second.data.expiresAt).toBe(first.data.expiresAt);
      expect(
        await t.prisma.examAttempt.count({ where: { examId: sc.exam.id, studentId: sc.student.id } }),
      ).toBe(1);
    });

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


    it('E1 5.11 "Max attempts": the refusal is exactly 403 MAX_ATTEMPTS_REACHED', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      await submitAttempt(t, sc.student, attempt.id);
      const again = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(again.status).toBe(403);
      expect(again.error!.code).toBe('MAX_ATTEMPTS_REACHED');
    });

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


    it('E1 5.11 "Authorization": a student who is not a member of an assigned classroom gets 403 NOT_ASSIGNED', async () => {
      const sc = await createExamScenario(t);
      const outsider = await createStudent(t);
      for (const assignmentId of [sc.assignment.id, undefined]) {
        const res = await startAttempt(t, outsider, sc.exam.id, assignmentId);
        expect(res.status).toBe(403);
        expect(res.error!.code).toBe('NOT_ASSIGNED');
      }
      expect(await t.prisma.examAttempt.count({ where: { examId: sc.exam.id } })).toBe(0);
    });

    it('a member of an archived classroom gets 403 NOT_ASSIGNED', async () => {
      const sc = await createExamScenario(t);
      await t.prisma.classroom.update({ where: { id: sc.classroom.id }, data: { archivedAt: new Date() } });
      const res = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(res.status).toBe(403);
      expect(res.error!.code).toBe('NOT_ASSIGNED');
    });

    it('D11: when the assignment has targets, a member who is not targeted gets 403 NOT_TARGETED and a targeted one starts', async () => {
      const sc = await createExamScenario(t);
      const targeted = await createStudent(t);
      await joinClassroom(t, targeted, sc.classroom.joinCode);
      await t.prisma.assignmentTarget.create({
        data: { assignmentId: sc.assignment.id, studentId: targeted.id },
      });

      const refused = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(refused.status).toBe(403);
      expect(refused.error!.code).toBe('NOT_TARGETED');
      const allowed = await startAttempt(t, targeted, sc.exam.id);
      expect(allowed.status).toBe(201);
      expect(allowed.data.assignmentId).toBe(sc.assignment.id);
    });

    it('E1 5.3 (design 5.1): without assignmentId the server resolves it; an assignment of another exam is 403 NOT_ASSIGNED; a CLOSED one is 403 ASSIGNMENT_CLOSED', async () => {
      const sc = await createExamScenario(t);
      const other = await createExamScenario(t);

      const foreign = await startAttempt(t, sc.student, sc.exam.id, other.assignment.id);
      expect(foreign.status).toBe(403);
      expect(foreign.error!.code).toBe('NOT_ASSIGNED');

      const resolved = await startAttempt(t, sc.student, sc.exam.id);
      expect(resolved.status).toBe(201);
      expect(resolved.data.assignmentId).toBe(sc.assignment.id);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: resolved.data.id } });
      expect(row!.assignmentId).toBe(sc.assignment.id);

      const closed = await createExamScenario(t);
      const close = await t.patch(`/assignments/${closed.assignment.id}/close`, { token: closed.teacher.token });
      expect(close.status).toBe(200);
      for (const assignmentId of [closed.assignment.id, undefined]) {
        const res = await startAttempt(t, closed.student, closed.exam.id, assignmentId);
        expect(res.status).toBe(403);
        expect(res.error!.code).toBe('ASSIGNMENT_CLOSED');
      }
      expect(await t.prisma.examAttempt.count({ where: { examId: closed.exam.id } })).toBe(0);
    });

    it('F4-BR-03: resume runs no checks: it still works after the assignment is closed, the deadline passes and the access code changes', async () => {
      const sc = await createExamScenario(t, { exam: { accessCode: 'Abc123' } });
      const first = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id, { accessCode: 'Abc123' });
      expect(first.status).toBe(201);

      await t.patch(`/assignments/${sc.assignment.id}/close`, { token: sc.teacher.token });
      await t.prisma.assignment.update({
        where: { id: sc.assignment.id },
        data: { dueAt: new Date(Date.now() - 60_000) },
      });
      await t.prisma.exam.update({ where: { id: sc.exam.id }, data: { accessCode: 'Changed' } });

      const again = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id);
      expect(again.status).toBe(200);
      expect(again.data.id).toBe(first.data.id);
      expect(again.data.status).toBe('IN_PROGRESS');
    });

    it('E1 5.11 "Access code": a missing or wrong code gets 403 INVALID_ACCESS_CODE (case-sensitive); the right code starts the attempt', async () => {
      const sc = await createExamScenario(t, { exam: { accessCode: 'Abc123' } });
      for (const extra of [{}, { accessCode: 'wrong' }, { accessCode: 'abc123' }]) {
        const res = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id, extra);
        expect(res.status).toBe(403);
        expect(res.error!.code).toBe('INVALID_ACCESS_CODE');
      }
      expect(await t.prisma.examAttempt.count({ where: { examId: sc.exam.id } })).toBe(0);

      const ok = await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id, { accessCode: 'Abc123' });
      expect(ok.status).toBe(201);
      expect(ok.raw).not.toContain('Abc123');
    });

    it('F4 5.11: a start after assignment.dueAt is refused with 403 DEADLINE_PASSED; before it, the attempt starts and expiresAt is not shortened', async () => {
      const late = await createExamScenario(t);
      await t.prisma.assignment.update({
        where: { id: late.assignment.id },
        data: { dueAt: new Date(Date.now() - 1000) },
      });
      const refused = await startAttempt(t, late.student, late.exam.id, late.assignment.id);
      expect(refused.status).toBe(403);
      expect(refused.error!.code).toBe('DEADLINE_PASSED');
      expect(await t.prisma.examAttempt.count({ where: { examId: late.exam.id } })).toBe(0);

      // Due in one minute, exam lasts ten: ruling D6, expiresAt = start + duration.
      const soon = await createExamScenario(t);
      await t.prisma.assignment.update({
        where: { id: soon.assignment.id },
        data: { dueAt: new Date(Date.now() + 60_000) },
      });
      const ok = await startAttempt(t, soon.student, soon.exam.id, soon.assignment.id);
      expect(ok.status).toBe(201);
      const windowMs = new Date(ok.data.expiresAt).getTime() - new Date(ok.data.startedAt).getTime();
      expect(windowMs).toBe(600_000);
    });

    it('error codes: unknown exam 404 EXAM_NOT_FOUND, DRAFT exam 400 EXAM_NOT_PUBLISHED, window 403 EXAM_NOT_YET_AVAILABLE / EXAM_EXPIRED, bad body 400 VALIDATION_ERROR', async () => {
      const teacher = await createTeacher(t);
      const student = await createStudent(t);
      const draft = await t.post('/exams', { token: teacher.token, body: { title: 'Nhap', durationSeconds: 600 } });

      const unknown = await startAttempt(t, student, '00000000-0000-0000-0000-000000000000');
      expect([unknown.status, unknown.error!.code]).toEqual([404, 'EXAM_NOT_FOUND']);
      const notPublished = await startAttempt(t, student, draft.data.id);
      expect([notPublished.status, notPublished.error!.code]).toEqual([400, 'EXAM_NOT_PUBLISHED']);
      const malformed = await startAttempt(t, student, 'not-a-uuid');
      expect([malformed.status, malformed.error!.code]).toEqual([400, 'VALIDATION_ERROR']);

      const day = 86_400_000;
      const future = await createExamScenario(t, {
        exam: { availableFrom: new Date(Date.now() + day).toISOString() },
      });
      const early = await startAttempt(t, future.student, future.exam.id, future.assignment.id);
      expect([early.status, early.error!.code]).toEqual([403, 'EXAM_NOT_YET_AVAILABLE']);
      const past = await createExamScenario(t, {
        exam: { availableUntil: new Date(Date.now() - day).toISOString() },
      });
      const over = await startAttempt(t, past.student, past.exam.id, past.assignment.id);
      expect([over.status, over.error!.code]).toEqual([403, 'EXAM_EXPIRED']);
    });

    it('an expired IN_PROGRESS attempt is auto-submitted by the next start, which then creates a new attempt or is refused', async () => {
      // maxAttempts = 2: the old attempt is submitted and a second one starts.
      const two = await createExamScenario(t, { exam: { maxAttempts: 2 } });
      const first = await started(two);
      const q = two.questions[0];
      await saveAnswer(t, two.student, first.id, q.examQuestionId, q.correctOptionId);
      const expiresAt = new Date(Date.now() - 5000);
      await t.prisma.examAttempt.update({ where: { id: first.id }, data: { expiresAt } });

      const second = await startAttempt(t, two.student, two.exam.id, two.assignment.id);
      expect(second.status).toBe(201);
      expect(second.data.id).not.toBe(first.id);
      const old = await t.prisma.examAttempt.findUnique({ where: { id: first.id } });
      expect(old!.status).toBe('SUBMITTED');
      expect(old!.score!.toFixed(2)).toBe('5.00');
      // submittedAt = min(now, expiresAt), not the time of the lazy submit.
      expect(old!.submittedAt!.getTime()).toBe(expiresAt.getTime());

      // maxAttempts = 1: the start is refused, and the old attempt is still submitted.
      const one = await createExamScenario(t);
      const only = await started(one);
      await t.prisma.examAttempt.update({
        where: { id: only.id },
        data: { expiresAt: new Date(Date.now() - 5000) },
      });
      const refused = await startAttempt(t, one.student, one.exam.id, one.assignment.id);
      expect([refused.status, refused.error!.code]).toEqual([403, 'MAX_ATTEMPTS_REACHED']);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: only.id } });
      expect(row!.status).toBe('SUBMITTED');
      expect(await t.prisma.examAttempt.count({ where: { examId: one.exam.id } })).toBe(1);
    });

    it('E1 5.8 "Concurrency Protection": five parallel starts by one student create exactly one attempt; one 201, four 200, same id', async () => {
      const sc = await createExamScenario(t, { exam: { maxAttempts: 3 } });
      const results = await Promise.all(
        Array.from({ length: 5 }, () => startAttempt(t, sc.student, sc.exam.id, sc.assignment.id)),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
      expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
      expect(
        await t.prisma.examAttempt.count({ where: { examId: sc.exam.id, studentId: sc.student.id } }),
      ).toBe(1);
    });

    it('backstop: the database refuses a second IN_PROGRESS attempt for the same student and exam', async () => {
      const sc = await createExamScenario(t, { exam: { maxAttempts: 3 } });
      const attempt = await started(sc);
      await expect(
        t.prisma.examAttempt.create({
          data: {
            examId: sc.exam.id,
            studentId: sc.student.id,
            assignmentId: sc.assignment.id,
            expiresAt: new Date(Date.now() + 600_000),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      // A SUBMITTED attempt does not block the next one.
      await submitAttempt(t, sc.student, attempt.id);
      expect((await startAttempt(t, sc.student, sc.exam.id, sc.assignment.id)).status).toBe(201);
    });
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


    it('E2 5.11 "Invalid question": an examQuestionId from a different exam is refused with 400 INVALID_QUESTION', async () => {
      const sc = await createExamScenario(t);
      const other = await createExamScenario(t);
      const attempt = await started(sc);
      const foreign = other.questions[0];
      const res = await saveAnswer(t, sc.student, attempt.id, foreign.examQuestionId, foreign.correctOptionId);
      expect([res.status, res.error!.code]).toEqual([400, 'INVALID_QUESTION']);
      expect(await t.prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(0);
    });

    it('E2 5.6: a selectedOptionId that is not an option of that question is refused with 400 INVALID_OPTION', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const [q1, q2] = sc.questions;
      for (const optionId of [q2.correctOptionId, 'no-such-option']) {
        const res = await saveAnswer(t, sc.student, attempt.id, q1.examQuestionId, optionId);
        expect([res.status, res.error!.code]).toEqual([400, 'INVALID_OPTION']);
      }
      expect(await t.prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(0);
    });

    it('E2 (module E): each question type takes its own payload shape, which is stored as sent', async () => {
      const sc = await createMixedScenario(t);
      const attempt = (await startAttempt(t, sc.student, sc.examId, sc.assignment.id)).data;
      const save = (eqId: string, payload: Record<string, unknown>) =>
        saveAnswerBody(t, sc.student, attempt.id, eqId, payload);

      const saved = await save(sc.mcq.eqId, { selectedOptionId: sc.mcq.correct });
      expect(saved.status).toBeLessThan(300);
      expect(Object.keys(saved.data).sort()).toEqual(['examQuestionId', 'savedAt']);
      expect(saved.data.examQuestionId).toBe(sc.mcq.eqId);

      const multi = [sc.multi.correct[0], sc.multi.wrong[0]];
      expect((await save(sc.multi.eqId, { selectedOptionIds: multi })).status).toBeLessThan(300);
      expect((await save(sc.trueFalse.eqId, { selectedOptionId: sc.trueFalse.wrong })).status).toBeLessThan(300);
      expect((await save(sc.short.eqId, { text: 'ha noi' })).status).toBeLessThan(300);
      expect((await save(sc.fill.eqId, { text: '42' })).status).toBeLessThan(300);
      expect((await save(sc.essay.eqId, { text: 'x'.repeat(1001) })).status).toBeLessThan(300);

      const rows = await t.prisma.answer.findMany({ where: { attemptId: attempt.id } });
      const payload = (eqId: string) => rows.find((r) => r.examQuestionId === eqId)!.answerPayload;
      expect(rows).toHaveLength(6);
      expect(payload(sc.mcq.eqId)).toEqual({ selectedOptionId: sc.mcq.correct });
      expect(payload(sc.multi.eqId)).toEqual({ selectedOptionIds: multi });
      expect(payload(sc.trueFalse.eqId)).toEqual({ selectedOptionId: sc.trueFalse.wrong });
      expect(payload(sc.short.eqId)).toEqual({ text: 'ha noi' });
      expect(payload(sc.fill.eqId)).toEqual({ text: '42' });
      expect(payload(sc.essay.eqId)).toEqual({ text: 'x'.repeat(1001) });

      // An empty selection clears a multi-select answer.
      expect((await save(sc.multi.eqId, { selectedOptionIds: [] })).status).toBeLessThan(300);
      expect(
        (await t.prisma.answer.findFirst({ where: { attemptId: attempt.id, examQuestionId: sc.multi.eqId } }))!
          .answerPayload,
      ).toEqual({ selectedOptionIds: [] });
    });

    it('E2: a payload of the wrong shape for the question type is refused with 400 VALIDATION_ERROR and stores nothing', async () => {
      const sc = await createMixedScenario(t);
      const attempt = (await startAttempt(t, sc.student, sc.examId, sc.assignment.id)).data;
      const bad: Array<[string, Record<string, unknown>]> = [
        [sc.mcq.eqId, { text: 'x' }],
        [sc.mcq.eqId, { selectedOptionIds: [sc.mcq.correct] }],
        [sc.multi.eqId, { selectedOptionId: sc.multi.correct[0] }],
        [sc.trueFalse.eqId, { text: 'Dung' }],
        [sc.short.eqId, { selectedOptionId: sc.mcq.correct }],
        [sc.essay.eqId, { selectedOptionIds: [] }],
        [sc.mcq.eqId, {}], // none of the three
        [sc.mcq.eqId, { selectedOptionId: sc.mcq.correct, text: 'x' }], // two of the three
        [sc.short.eqId, { text: 'x'.repeat(1001) }], // short answers: 1,000 characters
        [sc.fill.eqId, { text: 'x'.repeat(1001) }],
        [sc.essay.eqId, { text: 'x'.repeat(20001) }], // essays: 20,000 characters
        [sc.mcq.eqId, { selectedOptionId: sc.mcq.correct, isCorrect: true }], // unknown field
      ];
      for (const [eqId, payload] of bad) {
        const res = await saveAnswerBody(t, sc.student, attempt.id, eqId, payload);
        expect([res.status, res.error?.code, JSON.stringify(payload).slice(0, 60)]).toEqual([
          400,
          'VALIDATION_ERROR',
          JSON.stringify(payload).slice(0, 60),
        ]);
      }
      const wrongOption = await saveAnswerBody(t, sc.student, attempt.id, sc.multi.eqId, {
        selectedOptionIds: [sc.multi.correct[0], sc.mcq.correct],
      });
      expect([wrongOption.status, wrongOption.error!.code]).toEqual([400, 'INVALID_OPTION']);
      expect(await t.prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(0);
    });

    it('error codes: a save after submit is 400 ATTEMPT_ALREADY_SUBMITTED, after expiry 400 ATTEMPT_EXPIRED, by another student 403 NOT_ATTEMPT_OWNER, unknown attempt 404 ATTEMPT_NOT_FOUND', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];

      const intruder = await createStudent(t);
      const stolen = await saveAnswer(t, intruder, attempt.id, q.examQuestionId, q.correctOptionId);
      expect([stolen.status, stolen.error!.code]).toEqual([403, 'NOT_ATTEMPT_OWNER']);
      const missing = await saveAnswer(
        t,
        sc.student,
        '00000000-0000-0000-0000-000000000000',
        q.examQuestionId,
        q.correctOptionId,
      );
      expect([missing.status, missing.error!.code]).toEqual([404, 'ATTEMPT_NOT_FOUND']);

      await t.prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const expired = await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      expect([expired.status, expired.error!.code]).toEqual([400, 'ATTEMPT_EXPIRED']);
      const after = await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      expect([after.status, after.error!.code]).toEqual([400, 'ATTEMPT_ALREADY_SUBMITTED']);
      expect(await t.prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(0);
    });

    it('concurrency: saves racing a submit never change an answer after grading (score always matches the stored answers)', async () => {
      for (let round = 0; round < 5; round++) {
        const sc = await createExamScenario(t, { questionCount: 4 });
        const attempt = await started(sc);
        const results = await Promise.all([
          ...sc.questions.slice(0, 2).map((q) =>
            saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId),
          ),
          submitAttempt(t, sc.student, attempt.id),
          ...sc.questions.slice(2).map((q) =>
            saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId),
          ),
        ]);
        for (const r of results) expect(r.status).toBeLessThan(500);

        const row = await t.prisma.examAttempt.findUnique({
          where: { id: attempt.id },
          include: { answers: true },
        });
        expect(row!.status).toBe('SUBMITTED');
        // Every stored answer was graded: none slipped in after the grading read.
        for (const a of row!.answers) expect(a.earnedPoints).not.toBeNull();
        // Each stored answer is correct and worth 1 of 4 points.
        expect(row!.score!.toFixed(2)).toBe(((row!.answers.length / 4) * 10).toFixed(2));
        // A save that was accepted is stored; one that was refused is not.
        const accepted = results.filter((r, i) => i !== 2 && r.status < 300).length;
        expect(row!.answers).toHaveLength(accepted);
      }
    });
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


    it('E3 5.11 "Concurrent submit protection": parallel submits grade once: every response carries the same submittedAt', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => submitAttempt(t, sc.student, attempt.id)),
      );
      for (const r of results) expect(r.status).toBe(200);
      expect(new Set(results.map((r) => r.data.submittedAt)).size).toBe(1);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      expect(row!.submittedAt!.toISOString()).toBe(results[0].data.submittedAt);
      expect(Object.keys(results[0].data).sort()).toEqual(
        ['exam', 'id', 'resultsHidden', 'score', 'status', 'submittedAt'].sort(),
      );
    });

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


    it('G2 5.11 negative: GET /attempts/:id/result is 403 for another student and for a teacher who does not own the exam; owners get it without the answer key', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      await submitAttempt(t, sc.student, attempt.id);
      const url = `/attempts/${attempt.id}/result`;

      const intruder = await createStudent(t);
      await joinClassroom(t, intruder, sc.classroom.joinCode);
      expect((await t.get(url, { token: intruder.token })).status).toBe(403);
      const otherTeacher = await createTeacher(t);
      expect((await t.get(url, { token: otherTeacher.token })).status).toBe(403);
      expect((await t.get(url)).status).toBe(401);
      const missing = await t.get('/attempts/00000000-0000-0000-0000-000000000000/result', {
        token: sc.student.token,
      });
      expect([missing.status, missing.error!.code]).toEqual([404, 'ATTEMPT_NOT_FOUND']);

      for (const who of [sc.student, sc.teacher]) {
        const res = await t.get(url, { token: who.token });
        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({ id: attempt.id, status: 'SUBMITTED', resultsHidden: false });
        expect(Number(res.data.score)).toBe(5);
        expect(res.raw).not.toContain('optionsSnapshot');
        expect(res.raw).not.toContain('isCorrect');
      }
    });

    it('G1 (module G): every auto-gradable type is graded on submit; a non-empty ESSAY stays ungraded and counts 0 until a teacher grades it', async () => {
      const sc = await createMixedScenario(t);
      const attempt = (await startAttempt(t, sc.student, sc.examId, sc.assignment.id)).data;
      const save = (eqId: string, payload: Record<string, unknown>) =>
        saveAnswerBody(t, sc.student, attempt.id, eqId, payload);
      await save(sc.mcq.eqId, { selectedOptionId: sc.mcq.correct });
      await save(sc.multi.eqId, { selectedOptionIds: sc.multi.correct });
      await save(sc.trueFalse.eqId, { selectedOptionId: sc.trueFalse.correct });
      await save(sc.short.eqId, { text: '  ha   NOI ' }); // case and whitespace are ignored
      await save(sc.fill.eqId, { text: '42' });
      await save(sc.essay.eqId, { text: 'Bai tu luan' });

      const res = await submitAttempt(t, sc.student, attempt.id);
      expect(res.status).toBe(200);
      expect(Number(res.data.score)).toBe(8.33); // 5 of 6 points

      const rows = await t.prisma.answer.findMany({ where: { attemptId: attempt.id } });
      const earned = (eqId: string) => rows.find((r) => r.examQuestionId === eqId)!.earnedPoints;
      for (const eqId of [sc.mcq.eqId, sc.multi.eqId, sc.trueFalse.eqId, sc.short.eqId, sc.fill.eqId]) {
        expect(earned(eqId)!.toFixed(4)).toBe('1.0000');
      }
      expect(earned(sc.essay.eqId)).toBeNull();

      const review = await t.get(`/attempts/${attempt.id}/review`, { token: sc.teacher.token });
      expect(review.status).toBe(200);
      expect(review.data.gradingMode).toBe('ALL_OR_NOTHING');
      expect(review.data.gradingProgress).toEqual({ graded: 5, total: 6 });
      const item = (eqId: string) => review.data.questions.find((x: any) => x.examQuestionId === eqId);
      expect(item(sc.essay.eqId)).toMatchObject({
        questionType: 'ESSAY',
        text: 'Bai tu luan',
        earnedPoints: null,
        isCorrect: null,
        manuallyGraded: false,
      });
      expect(item(sc.short.eqId)).toMatchObject({
        questionType: 'SHORT_ANSWER',
        correctAnswer: 'Hà Nội, Ha Noi',
        explanation: 'Giai thich bi mat',
        earnedPoints: 1,
        isCorrect: true,
      });
      expect(item(sc.multi.eqId).correctOptionIds.sort()).toEqual([...sc.multi.correct].sort());
      expect(item(sc.multi.eqId).selectedOptionIds.sort()).toEqual([...sc.multi.correct].sort());
      expect(item(sc.mcq.eqId)).toMatchObject({
        correctOptionId: sc.mcq.correct,
        selectedOptionId: sc.mcq.correct,
      });

      const list = await t.get('/attempts', { token: sc.teacher.token, query: { examId: sc.examId } });
      expect(list.data[0]).toMatchObject({
        id: attempt.id,
        assignmentId: sc.assignment.id,
        attemptNumber: 1,
        gradingProgress: { graded: 5, total: 6 },
      });
    });

    it('G1: wrong, blank and missing answers earn 0 for every type; a blank ESSAY is graded 0, not left pending', async () => {
      const sc = await createMixedScenario(t);
      const attempt = (await startAttempt(t, sc.student, sc.examId, sc.assignment.id)).data;
      const save = (eqId: string, payload: Record<string, unknown>) =>
        saveAnswerBody(t, sc.student, attempt.id, eqId, payload);
      await save(sc.mcq.eqId, { selectedOptionId: sc.mcq.wrong });
      await save(sc.multi.eqId, { selectedOptionIds: sc.multi.correct.slice(0, 2) }); // a subset
      await save(sc.short.eqId, { text: 'Hue' });
      await save(sc.fill.eqId, { text: '   ' });
      await save(sc.essay.eqId, { text: '  ' });
      // TRUE_FALSE is left unanswered.

      const res = await submitAttempt(t, sc.student, attempt.id);
      expect(Number(res.data.score)).toBe(0);
      const rows = await t.prisma.answer.findMany({ where: { attemptId: attempt.id } });
      expect(rows).toHaveLength(5);
      for (const r of rows) expect(r.earnedPoints!.toFixed(4)).toBe('0.0000');
      const review = await t.get(`/attempts/${attempt.id}/review`, { token: sc.teacher.token });
      expect(review.data.gradingProgress).toEqual({ graded: 6, total: 6 });
      const unanswered = review.data.questions.find((x: any) => x.examQuestionId === sc.trueFalse.eqId);
      expect(unanswered).toMatchObject({ earnedPoints: 0, isCorrect: false, selectedOptionId: null });
    });

    it('G7 (ruling D5): PARTIAL mode gives max(0, right - wrong) / totalCorrect x points for MCQ_MULTI; ALL_OR_NOTHING gives 0 for the same answer', async () => {
      const expected = { PARTIAL: ['1.0000', '1.25'], ALL_OR_NOTHING: ['0.0000', '0.00'] } as const;
      for (const gradingMode of ['PARTIAL', 'ALL_OR_NOTHING'] as const) {
        // MCQ_MULTI is worth 3 points of 8; 3 correct options of 4.
        const sc = await createMixedScenario(t, { exam: { gradingMode }, points: [1, 3, 1, 1, 1, 1] });
        const attempt = (await startAttempt(t, sc.student, sc.examId, sc.assignment.id)).data;
        // Two right and one wrong: (2 - 1) / 3 x 3 = 1 point.
        await saveAnswerBody(t, sc.student, attempt.id, sc.multi.eqId, {
          selectedOptionIds: [sc.multi.correct[0], sc.multi.correct[1], sc.multi.wrong[0]],
        });
        await submitAttempt(t, sc.student, attempt.id);

        const answer = await t.prisma.answer.findFirst({ where: { attemptId: attempt.id } });
        expect(answer!.earnedPoints!.toFixed(4)).toBe(expected[gradingMode][0]);
        const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
        expect(row!.score!.toFixed(2)).toBe(expected[gradingMode][1]); // 1 / 8 x 10
      }
    });
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


    it('G5 5.11: with results hidden, submit, GET /attempts/:id, GET /attempts/my and GET /attempts/:id/result return no score or feedback to the student; review is 403 RESULTS_NOT_AVAILABLE', async () => {
      const sc = await createExamScenario(t, { exam: { showResultImmediately: false } });
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);

      const submitted = await submitAttempt(t, sc.student, attempt.id);
      expect(submitted.status).toBe(200);
      expect(submitted.data).toMatchObject({ status: 'SUBMITTED', score: null, resultsHidden: true });
      await t.patch(`/attempts/${attempt.id}/feedback`, {
        token: sc.teacher.token,
        body: { feedback: 'Nhan xet bi mat' },
      });

      const views = async () => ({
        get: await t.get(`/attempts/${attempt.id}`, { token: sc.student.token }),
        result: await t.get(`/attempts/${attempt.id}/result`, { token: sc.student.token }),
        mine: await t.get('/attempts/my', { token: sc.student.token }),
      });
      const check = async (visible: boolean) => {
        const v = await views();
        const bodies = [v.get.data, v.result.data, v.mine.data.find((a: any) => a.id === attempt.id)];
        for (const body of bodies) {
          expect(body.status).toBe('SUBMITTED');
          expect(body.resultsHidden).toBe(!visible);
          expect(body.score === null ? null : Number(body.score)).toBe(visible ? 5 : null);
          expect(body.feedback).toBe(visible ? 'Nhan xet bi mat' : null);
          expect(body.questions).toBeUndefined();
        }
        for (const res of [v.get, v.result, v.mine]) {
          expect(res.raw.includes('Nhan xet bi mat')).toBe(visible);
        }
        const review = await t.get(`/attempts/${attempt.id}/review`, { token: sc.student.token });
        if (visible) expect(review.status).toBe(200);
        else expect([review.status, review.error!.code]).toEqual([403, 'RESULTS_NOT_AVAILABLE']);
      };

      await check(false);
      // The score exists; it is only hidden. The teacher sees it.
      const asTeacher = await t.get(`/attempts/${attempt.id}/result`, { token: sc.teacher.token });
      expect(Number(asTeacher.data.score)).toBe(5);
      expect(asTeacher.data.feedback).toBe('Nhan xet bi mat');
      expect((await t.get(`/attempts/${attempt.id}/review`, { token: sc.teacher.token })).status).toBe(200);

      await t.patch(`/exams/${sc.exam.id}/release-results`, { token: sc.teacher.token, body: { release: true } });
      await check(true);

      // F9: the assignment's hideResults wins over a released exam.
      await t.prisma.assignment.update({ where: { id: sc.assignment.id }, data: { hideResults: true } });
      await check(false);
    });

    it('review requires a SUBMITTED attempt: 400 ATTEMPT_NOT_SUBMITTED while IN_PROGRESS, for the student and for the exam owner', async () => {
      const sc = await createExamScenario(t); // showResultImmediately = true
      const attempt = await started(sc);
      for (const who of [sc.student, sc.teacher]) {
        const res = await t.get(`/attempts/${attempt.id}/review`, { token: who.token });
        expect([res.status, res.error!.code]).toEqual([400, 'ATTEMPT_NOT_SUBMITTED']);
        expect(res.raw).not.toContain(sc.questions[0].correctOptionId);
      }
    });

    it('lazy expiry on the teacher list: GET /attempts?examId= submits an expired attempt first, with submittedAt = expiresAt', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const q = sc.questions[0];
      await saveAnswer(t, sc.student, attempt.id, q.examQuestionId, q.correctOptionId);
      const expiresAt = new Date(Date.now() - 3_600_000);
      await t.prisma.examAttempt.update({ where: { id: attempt.id }, data: { expiresAt } });

      const res = await t.get('/attempts', { token: sc.teacher.token, query: { examId: sc.exam.id } });
      expect(res.status).toBe(200);
      expect(res.data[0]).toMatchObject({
        id: attempt.id,
        status: 'SUBMITTED',
        submittedAt: expiresAt.toISOString(),
        gradingProgress: { graded: 2, total: 2 },
      });
      expect(Number(res.data[0].score)).toBe(5);
    });

    it('regrade (design 5.4) keeps manually graded answers, re-grades the others and reports {regraded, skipped}', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const [q1, q2] = sc.questions;
      await saveAnswer(t, sc.student, attempt.id, q1.examQuestionId, q1.correctOptionId);
      await saveAnswer(t, sc.student, attempt.id, q2.examQuestionId, q2.wrongOptionId);
      await submitAttempt(t, sc.student, attempt.id);

      const where = (examQuestionId: string) => ({
        attemptId_examQuestionId: { attemptId: attempt.id, examQuestionId },
      });
      // q1: a corrupted auto-graded value. q2: a teacher's manual grade.
      await t.prisma.answer.update({ where: where(q1.examQuestionId), data: { earnedPoints: 0 } });
      await t.prisma.answer.update({
        where: where(q2.examQuestionId),
        data: { earnedPoints: 0.5, manuallyGraded: true },
      });
      await t.prisma.examAttempt.update({ where: { id: attempt.id }, data: { score: 1 } });

      const res = await t.post(`/exams/${sc.exam.id}/regrade`, { token: sc.teacher.token });
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ regraded: 1, skipped: 0 });
      const a1 = await t.prisma.answer.findUnique({ where: where(q1.examQuestionId) });
      const a2 = await t.prisma.answer.findUnique({ where: where(q2.examQuestionId) });
      expect(a1!.earnedPoints!.toFixed(4)).toBe('1.0000');
      expect(a2!.earnedPoints!.toFixed(4)).toBe('0.5000');
      expect(a2!.manuallyGraded).toBe(true);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      expect(row!.score!.toFixed(2)).toBe('7.50'); // (1 + 0.5) / 2 x 10

      await t.patch(`/attempts/${attempt.id}/score`, { token: sc.teacher.token, body: { score: 3 } });
      const again = await t.post(`/exams/${sc.exam.id}/regrade`, { token: sc.teacher.token });
      expect(again.data).toEqual({ regraded: 0, skipped: 1 });
      expect((await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } }))!.score!.toFixed(2)).toBe(
        '3.00',
      );
    });

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


    it('G3 5.11 negative: score override and feedback on an IN_PROGRESS attempt are rejected with 400 ATTEMPT_NOT_SUBMITTED', async () => {
      const sc = await createExamScenario(t);
      const attempt = await started(sc);
      const score = await t.patch(`/attempts/${attempt.id}/score`, {
        token: sc.teacher.token,
        body: { score: 8 },
      });
      expect([score.status, score.error!.code]).toEqual([400, 'ATTEMPT_NOT_SUBMITTED']);
      const feedback = await t.patch(`/attempts/${attempt.id}/feedback`, {
        token: sc.teacher.token,
        body: { feedback: 'Tot' },
      });
      expect([feedback.status, feedback.error!.code]).toEqual([400, 'ATTEMPT_NOT_SUBMITTED']);
      const row = await t.prisma.examAttempt.findUnique({ where: { id: attempt.id } });
      expect(row).toMatchObject({ score: null, feedback: null, manualScoreOverride: false });
    });

    it('score override and feedback responses: {id, score, manualScoreOverride} and {id, feedback}; feedback over 5,000 characters is 400', async () => {
      const { sc, attemptId } = await submittedScenario();
      const score = await t.patch(`/attempts/${attemptId}/score`, {
        token: sc.teacher.token,
        body: { score: 7.25, reason: 'Cham lai' },
      });
      expect(score.status).toBe(200);
      expect(Object.keys(score.data).sort()).toEqual(['id', 'manualScoreOverride', 'score']);
      expect(Number(score.data.score)).toBe(7.25);
      expect(score.data.manualScoreOverride).toBe(true);

      const feedback = await t.patch(`/attempts/${attemptId}/feedback`, {
        token: sc.teacher.token,
        body: { feedback: 'Lam tot' },
      });
      expect(feedback.status).toBe(200);
      expect(feedback.data).toEqual({ id: attemptId, feedback: 'Lam tot' });

      const tooLong = await t.patch(`/attempts/${attemptId}/feedback`, {
        token: sc.teacher.token,
        body: { feedback: 'x'.repeat(5001) },
      });
      expect([tooLong.status, tooLong.error!.code]).toEqual([400, 'VALIDATION_ERROR']);
      const other = await createTeacher(t);
      expect(
        (await t.patch(`/attempts/${attemptId}/feedback`, { token: other.token, body: { feedback: 'x' } })).status,
      ).toBe(403);
    });
  });
});
