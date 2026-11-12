import { createTestApp, TestApp } from './support/app';
import {
  Actor,
  addExamQuestion,
  assignExam,
  createClassroom,
  createExam,
  createMcqQuestion,
  createStudent,
  createTeacher,
  publishExam,
} from './support/factories';

// Baseline for D1 create, D3 manage questions, D4 publish snapshot, D5/F1 assign.
// Spec: docs/features/exams/{create-exam,manage-questions,publish-exam,assign-exam}.md
describe('exams (baseline)', () => {
  let t: TestApp;
  let owner: Actor;
  let otherTeacher: Actor;
  let student: Actor;

  beforeAll(async () => {
    t = await createTestApp();
    await t.truncateAll();
    owner = await createTeacher(t);
    otherTeacher = await createTeacher(t);
    student = await createStudent(t);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('create (D1)', () => {
    it('creates a DRAFT exam with the documented defaults', async () => {
      const res = await t.post('/exams', {
        token: owner.token,
        body: { title: 'Kiem tra 15 phut', durationSeconds: 900 },
      });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        title: 'Kiem tra 15 phut',
        durationSeconds: 900,
        status: 'DRAFT',
        ownerId: owner.id,
        maxAttempts: 1,
        showResultImmediately: true,
        shuffleQuestions: false,
        shuffleOptions: false,
      });
    });

    it('boundary: durationSeconds 59 is rejected, 60 is accepted; maxAttempts 0 is rejected', async () => {
      const post = (body: Record<string, unknown>) => t.post('/exams', { token: owner.token, body });
      expect((await post({ title: 'X', durationSeconds: 59 })).status).toBe(400);
      expect((await post({ title: 'X', durationSeconds: 60 })).status).toBe(201);
      expect((await post({ title: 'X', durationSeconds: 600, maxAttempts: 0 })).status).toBe(400);
      expect((await post({ durationSeconds: 600 })).status).toBe(400);
    });

    it("a teacher lists only their own exams and cannot read another teacher's exam (403)", async () => {
      const mine = await createExam(t, owner);
      const theirs = await createExam(t, otherTeacher);
      const list = await t.get('/exams', { token: owner.token });
      const ids = list.data.map((e: any) => e.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
      expect((await t.get(`/exams/${theirs.id}`, { token: owner.token })).status).toBe(403);
      expect(
        (await t.patch(`/exams/${theirs.id}`, { token: owner.token, body: { title: 'Hack' } })).status,
      ).toBe(403);
    });
  });

  describe('manage questions (D3)', () => {
    it('adds an owned question with points and position; snapshot stays null until publish', async () => {
      const exam = await createExam(t, owner);
      const q = await createMcqQuestion(t, owner);
      const res = await t.post(`/exams/${exam.id}/questions`, {
        token: owner.token,
        body: { questionId: q.id, points: 2, position: 0 },
      });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        examId: exam.id,
        sourceQuestionId: q.id,
        points: 2,
        position: 0,
        contentSnapshot: null,
      });
    });

    it("adding another teacher's question returns 400 and adds nothing", async () => {
      const exam = await createExam(t, owner);
      const foreign = await createMcqQuestion(t, otherTeacher);
      const res = await t.post(`/exams/${exam.id}/questions`, {
        token: owner.token,
        body: { questionId: foreign.id, points: 1, position: 0 },
      });
      expect(res.status).toBe(400);
      expect(await t.prisma.examQuestion.count({ where: { examId: exam.id } })).toBe(0);
    });

    it("a teacher cannot add a question to another teacher's exam (403)", async () => {
      const exam = await createExam(t, owner);
      const q = await createMcqQuestion(t, otherTeacher);
      const res = await t.post(`/exams/${exam.id}/questions`, {
        token: otherTeacher.token,
        body: { questionId: q.id, points: 1, position: 0 },
      });
      expect(res.status).toBe(403);
      expect(await t.prisma.examQuestion.count({ where: { examId: exam.id } })).toBe(0);
    });

    it('boundary: points 0 is rejected (400)', async () => {
      const exam = await createExam(t, owner);
      const q = await createMcqQuestion(t, owner);
      const res = await t.post(`/exams/${exam.id}/questions`, {
        token: owner.token,
        body: { questionId: q.id, points: 0, position: 0 },
      });
      expect(res.status).toBe(400);
    });

    it('removes a question from a DRAFT exam; the other positions are unchanged', async () => {
      const exam = await createExam(t, owner);
      const eqs = [];
      for (let i = 0; i < 3; i++) {
        const q = await createMcqQuestion(t, owner);
        eqs.push(await addExamQuestion(t, owner, exam.id, q.id, i));
      }
      const res = await t.delete(`/exams/${exam.id}/questions/${eqs[1].id}`, { token: owner.token });
      expect(res.status).toBe(204);
      const rows = await t.prisma.examQuestion.findMany({
        where: { examId: exam.id },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((r) => [r.id, r.position])).toEqual([
        [eqs[0].id, 0],
        [eqs[2].id, 2],
      ]);
    });

    it.todo(
      'D3 5.2 (defect, see report): DELETE /exams/:id/questions/:eqId refuses an eqId that belongs to a different exam (exams.service.ts removeQuestion deletes by eqId alone)',
    );
  });

  describe('publish snapshot (D4)', () => {
    it('publishing copies content and options (with isCorrect) into every exam question', async () => {
      const exam = await createExam(t, owner);
      const q1 = await createMcqQuestion(t, owner, { content: 'Cau 1', correctIndex: 1 });
      const q2 = await createMcqQuestion(t, owner, { content: 'Cau 2', correctIndex: 3 });
      await addExamQuestion(t, owner, exam.id, q1.id, 0, 2);
      await addExamQuestion(t, owner, exam.id, q2.id, 1, 3);

      const res = await t.post(`/exams/${exam.id}/publish`, { token: owner.token });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('PUBLISHED');

      const rows = await t.prisma.examQuestion.findMany({
        where: { examId: exam.id },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((r) => r.contentSnapshot)).toEqual(['Cau 1', 'Cau 2']);
      for (const [row, src] of [
        [rows[0], q1],
        [rows[1], q2],
      ] as const) {
        const snap = row.optionsSnapshot as Array<{ id: string; content: string; isCorrect: boolean }>;
        expect(snap).toHaveLength(4);
        expect(snap.map((o) => o.content)).toEqual(src.options.map((o) => o.content));
        expect(snap.map((o) => o.isCorrect)).toEqual(src.options.map((o) => o.isCorrect));
      }
    });

    it('editing or deleting the source question after publish leaves the snapshot intact', async () => {
      const exam = await createExam(t, owner);
      const q1 = await createMcqQuestion(t, owner, { content: 'Ban dau 1' });
      const q2 = await createMcqQuestion(t, owner, { content: 'Ban dau 2' });
      await addExamQuestion(t, owner, exam.id, q1.id, 0);
      await addExamQuestion(t, owner, exam.id, q2.id, 1);
      await publishExam(t, owner, exam.id);
      const before = await t.prisma.examQuestion.findMany({
        where: { examId: exam.id },
        orderBy: { position: 'asc' },
      });

      const edit = await t.patch(`/questions/${q1.id}`, {
        token: owner.token,
        body: {
          content: 'Da sua',
          options: [
            { content: 'Moi A', isCorrect: false, position: 0 },
            { content: 'Moi B', isCorrect: true, position: 1 },
          ],
        },
      });
      expect(edit.status).toBe(200);
      const del = await t.delete(`/questions/${q2.id}`, { token: owner.token });
      expect(del.status).toBe(204);

      const after = await t.prisma.examQuestion.findMany({
        where: { examId: exam.id },
        orderBy: { position: 'asc' },
      });
      expect(after[0].contentSnapshot).toBe('Ban dau 1');
      expect(after[0].optionsSnapshot).toEqual(before[0].optionsSnapshot);
      expect(after[1].sourceQuestionId).toBeNull();
      expect(after[1].contentSnapshot).toBe('Ban dau 2');
      expect(after[1].optionsSnapshot).toEqual(before[1].optionsSnapshot);
    });

    it('an exam with no questions cannot be published (400) and stays DRAFT', async () => {
      const exam = await createExam(t, owner);
      const res = await t.post(`/exams/${exam.id}/publish`, { token: owner.token });
      expect(res.status).toBe(400);
      expect((await t.prisma.exam.findUnique({ where: { id: exam.id } }))!.status).toBe('DRAFT');
    });

    it('a PUBLISHED exam cannot be published again, edited, or have questions added or removed (400)', async () => {
      const exam = await createExam(t, owner);
      const q = await createMcqQuestion(t, owner);
      const eq = await addExamQuestion(t, owner, exam.id, q.id, 0);
      await publishExam(t, owner, exam.id);
      const q2 = await createMcqQuestion(t, owner);

      expect((await t.post(`/exams/${exam.id}/publish`, { token: owner.token })).status).toBe(400);
      expect(
        (await t.patch(`/exams/${exam.id}`, { token: owner.token, body: { durationSeconds: 61 } })).status,
      ).toBe(400);
      expect(
        (
          await t.post(`/exams/${exam.id}/questions`, {
            token: owner.token,
            body: { questionId: q2.id, points: 1, position: 1 },
          })
        ).status,
      ).toBe(400);
      expect(
        (await t.delete(`/exams/${exam.id}/questions/${eq.id}`, { token: owner.token })).status,
      ).toBe(400);
      expect(await t.prisma.examQuestion.count({ where: { examId: exam.id } })).toBe(1);
    });

    it("a teacher cannot publish another teacher's exam (403); a student cannot publish (403)", async () => {
      const exam = await createExam(t, owner);
      const q = await createMcqQuestion(t, owner);
      await addExamQuestion(t, owner, exam.id, q.id, 0);
      expect((await t.post(`/exams/${exam.id}/publish`, { token: otherTeacher.token })).status).toBe(403);
      expect((await t.post(`/exams/${exam.id}/publish`, { token: student.token })).status).toBe(403);
      expect((await t.prisma.exam.findUnique({ where: { id: exam.id } }))!.status).toBe('DRAFT');
    });

    it('concurrency: two parallel publishes leave one PUBLISHED exam with one consistent snapshot', async () => {
      const exam = await createExam(t, owner);
      const q = await createMcqQuestion(t, owner, { content: 'Song song' });
      await addExamQuestion(t, owner, exam.id, q.id, 0);
      const results = await Promise.all([
        t.post(`/exams/${exam.id}/publish`, { token: owner.token }),
        t.post(`/exams/${exam.id}/publish`, { token: owner.token }),
      ]);
      expect(results.some((r) => r.status === 200)).toBe(true);
      const row = await t.prisma.exam.findUnique({
        where: { id: exam.id },
        include: { questions: true },
      });
      expect(row!.status).toBe('PUBLISHED');
      expect(row!.questions).toHaveLength(1);
      expect(row!.questions[0].contentSnapshot).toBe('Song song');
    });
  });

  describe('assign to a classroom (D5 / F1)', () => {
    async function publishedExam(teacher: Actor) {
      const exam = await createExam(t, teacher);
      const q = await createMcqQuestion(t, teacher);
      await addExamQuestion(t, teacher, exam.id, q.id, 0);
      await publishExam(t, teacher, exam.id);
      return exam;
    }

    it('assigns a PUBLISHED exam to an owned classroom with an optional due date', async () => {
      const exam = await publishedExam(owner);
      const classroom = await createClassroom(t, owner);
      const dueAt = new Date(Date.now() + 86_400_000).toISOString();
      const res = await t.post('/assignments', {
        token: owner.token,
        body: { examId: exam.id, classroomId: classroom.id, dueAt },
      });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ examId: exam.id, classroomId: classroom.id, status: 'ACTIVE' });
      expect(new Date(res.data.dueAt).toISOString()).toBe(dueAt);
    });

    it('a DRAFT exam cannot be assigned (400)', async () => {
      const exam = await createExam(t, owner);
      const classroom = await createClassroom(t, owner);
      const res = await t.post('/assignments', {
        token: owner.token,
        body: { examId: exam.id, classroomId: classroom.id },
      });
      expect(res.status).toBe(400);
      expect(await t.prisma.assignment.count({ where: { examId: exam.id } })).toBe(0);
    });

    it("an exam or classroom owned by another teacher cannot be used (4xx) and nothing is created", async () => {
      const myExam = await publishedExam(owner);
      const theirExam = await publishedExam(otherTeacher);
      const myClass = await createClassroom(t, owner);
      const theirClass = await createClassroom(t, otherTeacher);
      const a = await t.post('/assignments', {
        token: owner.token,
        body: { examId: theirExam.id, classroomId: myClass.id },
      });
      const b = await t.post('/assignments', {
        token: owner.token,
        body: { examId: myExam.id, classroomId: theirClass.id },
      });
      for (const r of [a, b]) {
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
      }
      expect(
        await t.prisma.assignment.count({
          where: { OR: [{ examId: theirExam.id }, { classroomId: theirClass.id }] },
        }),
      ).toBe(0);
    });

    it('a student cannot create an assignment (403)', async () => {
      const exam = await publishedExam(owner);
      const classroom = await createClassroom(t, owner);
      const res = await t.post('/assignments', {
        token: student.token,
        body: { examId: exam.id, classroomId: classroom.id },
      });
      expect(res.status).toBe(403);
    });

    it('listing assignments: the owner and a member may list; a non-member student and a non-owner teacher get 403', async () => {
      const exam = await publishedExam(owner);
      const classroom = await createClassroom(t, owner);
      const assignment = await assignExam(t, owner, exam.id, classroom.id);
      const member = await createStudent(t);
      await t.post('/classrooms/join', { token: member.token, body: { joinCode: classroom.joinCode } });

      const q = { classroomId: classroom.id };
      for (const who of [owner, member]) {
        const res = await t.get('/assignments', { token: who.token, query: q });
        expect(res.status).toBe(200);
        expect(res.data.map((a: any) => a.id)).toEqual([assignment.id]);
      }
      expect((await t.get('/assignments', { token: student.token, query: q })).status).toBe(403);
      expect((await t.get('/assignments', { token: otherTeacher.token, query: q })).status).toBe(403);
    });

    it.todo(
      'F2 5.2 (known defect): GET /assignments/:id is refused (403) for a student who is not a member and a teacher who does not own the classroom',
    );
    it.todo(
      'D5/F1 (defect, see report): assigning the same exam to the same classroom twice returns 409, not 500 (assignments.service.ts create: unique (examId, classroomId) not handled)',
    );
  });
});
