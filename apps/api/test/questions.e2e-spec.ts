import { createTestApp, TestApp } from './support/app';
import {
  Actor,
  createMcqQuestion,
  createStudent,
  createTeacher,
} from './support/factories';

// Baseline for C1 create, C2 edit/delete, C5 list: ownership and validation.
// Spec: docs/features/question-bank/{create-question,edit-question}.md
describe('question bank (baseline)', () => {
  let t: TestApp;
  let owner: Actor;
  let otherTeacher: Actor;
  let student: Actor;

  const mcq = (correct: number[], count = 4) => ({
    type: 'MCQ',
    content: '2 + 2 = ?',
    options: Array.from({ length: count }, (_, i) => ({
      content: `Lua chon ${i}`,
      isCorrect: correct.includes(i),
      position: i,
    })),
  });

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

  describe('create (C1)', () => {
    it('creates an MCQ with its options in position order', async () => {
      const res = await t.post('/questions', { token: owner.token, body: mcq([2]) });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ type: 'MCQ', content: '2 + 2 = ?', ownerId: owner.id });
      expect(res.data.options.map((o: any) => o.position)).toEqual([0, 1, 2, 3]);
      expect(res.data.options.map((o: any) => o.isCorrect)).toEqual([false, false, true, false]);
    });

    it('rejects an MCQ with zero or two correct options (400) and stores nothing', async () => {
      const before = await t.prisma.question.count();
      expect((await t.post('/questions', { token: owner.token, body: mcq([]) })).status).toBe(400);
      expect((await t.post('/questions', { token: owner.token, body: mcq([0, 1]) })).status).toBe(400);
      expect(await t.prisma.question.count()).toBe(before);
    });

    it('boundary: one option is rejected (400), two options are accepted', async () => {
      expect((await t.post('/questions', { token: owner.token, body: mcq([0], 1) })).status).toBe(400);
      expect((await t.post('/questions', { token: owner.token, body: mcq([0], 2) })).status).toBe(201);
    });

    it('rejects a missing content, an unknown type and an unknown difficulty (400)', async () => {
      const { content: _c, ...noContent } = mcq([0]);
      expect((await t.post('/questions', { token: owner.token, body: noContent })).status).toBe(400);
      expect(
        (await t.post('/questions', { token: owner.token, body: { ...mcq([0]), type: 'MATCHING' } })).status,
      ).toBe(400);
      expect(
        (await t.post('/questions', { token: owner.token, body: { ...mcq([0]), difficulty: 'EXTREME' } })).status,
      ).toBe(400);
    });

    it('a student cannot create a question (403); an anonymous caller gets 401', async () => {
      expect((await t.post('/questions', { token: student.token, body: mcq([0]) })).status).toBe(403);
      expect((await t.post('/questions', { body: mcq([0]) })).status).toBe(401);
    });
  });

  describe('read and list ownership', () => {
    it('a teacher lists only their own questions', async () => {
      const mine = await createMcqQuestion(t, owner);
      const theirs = await createMcqQuestion(t, otherTeacher);
      const res = await t.get('/questions', { token: owner.token });
      expect(res.status).toBe(200);
      const ids = res.data.items.map((q: any) => q.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
      expect(res.body.meta.total).toBe(
        await t.prisma.question.count({ where: { ownerId: owner.id } }),
      );
    });

    it.todo(
      'C5 (defect, see report): GET /questions?page=1&limit=1 returns 200 with one item and meta {page, limit, total, totalPages}; today any page/limit gives 500 and no page/limit returns every row (questions.controller.ts findAll: @Query typed as an intersection, so the DTO is never instantiated)',
    );

    it("a teacher cannot read another teacher's question (403); unknown id is 404", async () => {
      const theirs = await createMcqQuestion(t, otherTeacher);
      expect((await t.get(`/questions/${theirs.id}`, { token: owner.token })).status).toBe(403);
      expect(
        (await t.get('/questions/00000000-0000-0000-0000-000000000000', { token: owner.token })).status,
      ).toBe(404);
    });
  });

  describe('edit and delete (C2)', () => {
    it('the owner updates the content', async () => {
      const q = await createMcqQuestion(t, owner);
      const res = await t.patch(`/questions/${q.id}`, {
        token: owner.token,
        body: { content: 'Noi dung moi' },
      });
      expect(res.status).toBe(200);
      expect(res.data.content).toBe('Noi dung moi');
      expect(res.data.options).toHaveLength(4);
    });

    it('the owner replaces the options: old rows are gone, new ones stored', async () => {
      const q = await createMcqQuestion(t, owner);
      const res = await t.patch(`/questions/${q.id}`, {
        token: owner.token,
        body: {
          options: [
            { content: 'Dung', isCorrect: true, position: 0 },
            { content: 'Sai', isCorrect: false, position: 1 },
          ],
        },
      });
      expect(res.status).toBe(200);
      const rows = await t.prisma.questionOption.findMany({
        where: { questionId: q.id },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((o) => [o.content, o.isCorrect])).toEqual([
        ['Dung', true],
        ['Sai', false],
      ]);
    });

    it('updating MCQ options without exactly one correct answer returns 400 and keeps the old options', async () => {
      const q = await createMcqQuestion(t, owner);
      const res = await t.patch(`/questions/${q.id}`, {
        token: owner.token,
        body: {
          options: [
            { content: 'A', isCorrect: false, position: 0 },
            { content: 'B', isCorrect: false, position: 1 },
          ],
        },
      });
      expect(res.status).toBe(400);
      expect(await t.prisma.questionOption.count({ where: { questionId: q.id } })).toBe(4);
      expect(
        await t.prisma.questionOption.count({ where: { questionId: q.id, isCorrect: true } }),
      ).toBe(1);
    });

    it("another teacher cannot edit or delete the question (403) and it is unchanged", async () => {
      const q = await createMcqQuestion(t, owner, { content: 'Goc' });
      expect(
        (await t.patch(`/questions/${q.id}`, { token: otherTeacher.token, body: { content: 'Hack' } })).status,
      ).toBe(403);
      expect((await t.delete(`/questions/${q.id}`, { token: otherTeacher.token })).status).toBe(403);
      const row = await t.prisma.question.findUnique({ where: { id: q.id } });
      expect(row!.content).toBe('Goc');
    });

    it('a student cannot edit or delete any question (403)', async () => {
      const q = await createMcqQuestion(t, owner);
      expect(
        (await t.patch(`/questions/${q.id}`, { token: student.token, body: { content: 'X' } })).status,
      ).toBe(403);
      expect((await t.delete(`/questions/${q.id}`, { token: student.token })).status).toBe(403);
      expect(await t.prisma.question.count({ where: { id: q.id } })).toBe(1);
    });

    it('the owner deletes the question: 204, question and options removed', async () => {
      const q = await createMcqQuestion(t, owner);
      const res = await t.delete(`/questions/${q.id}`, { token: owner.token });
      expect(res.status).toBe(204);
      expect(await t.prisma.question.count({ where: { id: q.id } })).toBe(0);
      expect(await t.prisma.questionOption.count({ where: { questionId: q.id } })).toBe(0);
      expect((await t.delete(`/questions/${q.id}`, { token: owner.token })).status).toBe(404);
    });
  });
});
