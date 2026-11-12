import { createTestApp, TestApp } from './support/app';
import {
  Actor,
  createClassroom,
  createStudent,
  createTeacher,
  joinClassroom,
} from './support/factories';

// Baseline for B1 create, B2 join, B3 members, B4 edit/delete/archive.
// Spec: docs/features/classrooms/*.md
describe('classrooms (baseline)', () => {
  let t: TestApp;
  let owner: Actor;
  let otherTeacher: Actor;
  let student: Actor;
  let student2: Actor;

  beforeAll(async () => {
    t = await createTestApp();
    await t.truncateAll();
    owner = await createTeacher(t);
    otherTeacher = await createTeacher(t);
    student = await createStudent(t);
    student2 = await createStudent(t);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('create and list', () => {
    it('B1: a teacher creates a classroom and receives a join code', async () => {
      const res = await t.post('/classrooms', { token: owner.token, body: { name: 'Toan 10A' } });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ name: 'Toan 10A', ownerId: owner.id });
      expect(res.data.joinCode).toMatch(/^[A-Z0-9]{6,8}$/);
    });

    it('B1: an empty or missing name returns 400', async () => {
      expect((await t.post('/classrooms', { token: owner.token, body: { name: '' } })).status).toBe(400);
      expect((await t.post('/classrooms', { token: owner.token, body: {} })).status).toBe(400);
    });

    it('B1: a teacher lists only the classrooms they own', async () => {
      const mine = await createClassroom(t, owner);
      const theirs = await createClassroom(t, otherTeacher);
      const res = await t.get('/classrooms', { token: owner.token });
      expect(res.status).toBe(200);
      const ids = res.data.map((c: any) => c.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
    });
  });

  describe('join (B2)', () => {
    it('a student joins by code, sees the classroom, and appears in the member list', async () => {
      const c = await createClassroom(t, owner);
      const res = await t.post('/classrooms/join', {
        token: student.token,
        body: { joinCode: c.joinCode },
      });
      expect([200, 201]).toContain(res.status);

      const list = await t.get('/classrooms', { token: student.token });
      expect(list.data.map((x: any) => x.id)).toContain(c.id);

      const members = await t.get(`/classrooms/${c.id}/members`, { token: owner.token });
      expect(members.status).toBe(200);
      expect(members.data).toHaveLength(1);
      expect(members.data[0].user).toMatchObject({
        id: student.id,
        email: student.email,
        displayName: student.displayName,
      });
      expect(members.data[0].joinedAt).toBeTruthy();
      expect(members.raw).not.toMatch(/passwordHash|password_hash/);
    });

    it('idempotency: joining twice succeeds and leaves exactly one membership row', async () => {
      const c = await createClassroom(t, owner);
      const a = await t.post('/classrooms/join', { token: student.token, body: { joinCode: c.joinCode } });
      const b = await t.post('/classrooms/join', { token: student.token, body: { joinCode: c.joinCode } });
      expect([200, 201]).toContain(a.status);
      expect([200, 201]).toContain(b.status);
      expect(
        await t.prisma.classroomMember.count({ where: { classroomId: c.id, userId: student.id } }),
      ).toBe(1);
    });

    it('concurrency: five parallel joins leave exactly one membership row', async () => {
      const c = await createClassroom(t, owner);
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          t.post('/classrooms/join', { token: student2.token, body: { joinCode: c.joinCode } }),
        ),
      );
      expect(results.some((r) => r.status === 200 || r.status === 201)).toBe(true);
      expect(
        await t.prisma.classroomMember.count({ where: { classroomId: c.id, userId: student2.id } }),
      ).toBe(1);
    });

    it.todo(
      'B2 5.11 "already joined ... response is successful" (defect, see report): every one of N parallel joins returns success, none returns 500 (classrooms.service.ts join: find-then-create race on the unique index)',
    );

    it('an unknown join code returns 400 and creates no membership', async () => {
      const before = await t.prisma.classroomMember.count({ where: { userId: student.id } });
      const res = await t.post('/classrooms/join', {
        token: student.token,
        body: { joinCode: 'ZZZZZZ' },
      });
      expect(res.status).toBe(400);
      expect(await t.prisma.classroomMember.count({ where: { userId: student.id } })).toBe(before);
    });

    it('a teacher gets 403 and an anonymous caller gets 401', async () => {
      const c = await createClassroom(t, owner);
      expect(
        (await t.post('/classrooms/join', { token: otherTeacher.token, body: { joinCode: c.joinCode } })).status,
      ).toBe(403);
      expect((await t.post('/classrooms/join', { body: { joinCode: c.joinCode } })).status).toBe(401);
    });
  });

  describe('members (B3)', () => {
    it('lists members ordered by joinedAt ascending', async () => {
      const c = await createClassroom(t, owner);
      await joinClassroom(t, student2, c.joinCode);
      await joinClassroom(t, student, c.joinCode);
      const res = await t.get(`/classrooms/${c.id}/members`, { token: owner.token });
      expect(res.data.map((m: any) => m.user.id)).toEqual([student2.id, student.id]);
    });

    it('the owner removes a student: membership is gone and the student no longer lists the classroom', async () => {
      const c = await createClassroom(t, owner);
      await joinClassroom(t, student, c.joinCode);
      const res = await t.delete(`/classrooms/${c.id}/members/${student.id}`, { token: owner.token });
      expect(res.status).toBe(204);
      expect(await t.prisma.classroomMember.count({ where: { classroomId: c.id } })).toBe(0);
      const list = await t.get('/classrooms', { token: student.token });
      expect(list.data.map((x: any) => x.id)).not.toContain(c.id);
    });

    it('a teacher who does not own the classroom gets 403 and the membership is untouched', async () => {
      const c = await createClassroom(t, owner);
      await joinClassroom(t, student, c.joinCode);
      const res = await t.delete(`/classrooms/${c.id}/members/${student.id}`, {
        token: otherTeacher.token,
      });
      expect(res.status).toBe(403);
      expect(await t.prisma.classroomMember.count({ where: { classroomId: c.id } })).toBe(1);
    });

    it('a student cannot remove a member (403)', async () => {
      const c = await createClassroom(t, owner);
      await joinClassroom(t, student, c.joinCode);
      await joinClassroom(t, student2, c.joinCode);
      const res = await t.delete(`/classrooms/${c.id}/members/${student2.id}`, { token: student.token });
      expect(res.status).toBe(403);
      expect(await t.prisma.classroomMember.count({ where: { classroomId: c.id } })).toBe(2);
    });

    it('removing a user who is not a member returns 404', async () => {
      const c = await createClassroom(t, owner);
      const res = await t.delete(`/classrooms/${c.id}/members/${student.id}`, { token: owner.token });
      expect(res.status).toBe(404);
    });

    it.todo(
      'B3 5.2 (defect, see report): GET /classrooms/:id/members is refused (403) for a teacher who does not own the classroom and for a student who is not a member',
    );
    it.todo(
      'B1 5.2 (defect, see report): GET /classrooms/:id is refused (403) for a non-owner teacher and a non-member student, and never exposes joinCode to them',
    );
  });

  describe('edit, delete, archive (B4)', () => {
    it('the owner renames the classroom; the join code is unchanged', async () => {
      const c = await createClassroom(t, owner);
      const res = await t.patch(`/classrooms/${c.id}`, { token: owner.token, body: { name: 'New Name' } });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'New Name', joinCode: c.joinCode });
    });

    it('a non-owner teacher cannot rename, archive or delete (403) and nothing changes', async () => {
      const c = await createClassroom(t, owner, 'Keep me');
      const tok = { token: otherTeacher.token };
      expect((await t.patch(`/classrooms/${c.id}`, { ...tok, body: { name: 'Hacked' } })).status).toBe(403);
      expect((await t.patch(`/classrooms/${c.id}/archive`, tok)).status).toBe(403);
      expect((await t.delete(`/classrooms/${c.id}`, tok)).status).toBe(403);
      const row = await t.prisma.classroom.findUnique({ where: { id: c.id } });
      expect(row).toMatchObject({ name: 'Keep me', archivedAt: null });
    });

    it('a student cannot rename or delete a classroom they belong to (403)', async () => {
      const c = await createClassroom(t, owner);
      await joinClassroom(t, student, c.joinCode);
      expect(
        (await t.patch(`/classrooms/${c.id}`, { token: student.token, body: { name: 'X' } })).status,
      ).toBe(403);
      expect((await t.delete(`/classrooms/${c.id}`, { token: student.token })).status).toBe(403);
    });

    it('deleting a classroom with members and no assignments removes the memberships too', async () => {
      const c = await createClassroom(t, owner);
      await joinClassroom(t, student, c.joinCode);
      await joinClassroom(t, student2, c.joinCode);
      const res = await t.delete(`/classrooms/${c.id}`, { token: owner.token });
      expect(res.status).toBe(204);
      expect(await t.prisma.classroom.count({ where: { id: c.id } })).toBe(0);
      expect(await t.prisma.classroomMember.count({ where: { classroomId: c.id } })).toBe(0);
    });

    it('archive hides the classroom from owner and member lists; unarchive restores it', async () => {
      const c = await createClassroom(t, owner);
      await joinClassroom(t, student, c.joinCode);

      const arch = await t.patch(`/classrooms/${c.id}/archive`, { token: owner.token });
      expect(arch.status).toBe(200);
      expect(arch.data.archivedAt).toBeTruthy();
      for (const who of [owner, student]) {
        const list = await t.get('/classrooms', { token: who.token });
        expect(list.data.map((x: any) => x.id)).not.toContain(c.id);
      }

      const un = await t.patch(`/classrooms/${c.id}/unarchive`, { token: owner.token });
      expect(un.status).toBe(200);
      expect(un.data.archivedAt).toBeNull();
      for (const who of [owner, student]) {
        const list = await t.get('/classrooms', { token: who.token });
        expect(list.data.map((x: any) => x.id)).toContain(c.id);
      }
    });

    it('an unknown classroom id returns 404', async () => {
      const res = await t.patch('/classrooms/00000000-0000-0000-0000-000000000000', {
        token: owner.token,
        body: { name: 'X' },
      });
      expect(res.status).toBe(404);
    });
  });
});
