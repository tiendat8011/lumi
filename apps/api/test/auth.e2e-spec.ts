import { createTestApp, TestApp } from './support/app';
import {
  createStudent,
  createTeacher,
  DEFAULT_PASSWORD,
  unique,
} from './support/factories';

// Baseline for A1 (register), A2 (login / refresh / logout), A5 (role guard).
// Spec: docs/features/authentication/{register,login-logout,role-management}.md
describe('auth (baseline)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await t.truncateAll();
  });

  afterAll(async () => {
    await t.close();
  });

  const newUser = (role: string, over: Record<string, unknown> = {}) => ({
    email: `${unique('reg')}@example.test`,
    password: DEFAULT_PASSWORD,
    displayName: 'Nguyen Van A',
    role,
    ...over,
  });

  describe('POST /auth/register', () => {
    it.each(['STUDENT', 'TEACHER'])(
      'AC-A1-01/02: creates a %s account and never returns the password hash',
      async (role) => {
        const body = newUser(role);
        const res = await t.post('/auth/register', { body });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.raw).not.toMatch(/passwordHash|password_hash/);

        const row = await t.prisma.user.findUnique({ where: { email: body.email } });
        expect(row).not.toBeNull();
        expect(row!.role).toBe(role);
        expect(row!.displayName).toBe(body.displayName);
        expect(row!.passwordHash).not.toBe(body.password);
      },
    );

    it('AC-A1-03: a registered user can log in with the same credentials', async () => {
      const body = newUser('STUDENT');
      await t.post('/auth/register', { body });
      const login = await t.post('/auth/login', {
        body: { email: body.email, password: body.password },
      });
      expect(login.status).toBe(200);
      expect(login.data.user.email).toBe(body.email);
    });

    it('AC-A1-04: a duplicate email returns 409 and creates no second account', async () => {
      const body = newUser('STUDENT');
      expect((await t.post('/auth/register', { body })).status).toBe(201);
      const dup = await t.post('/auth/register', { body: { ...body, displayName: 'Other' } });
      expect(dup.status).toBe(409);
      expect(dup.body.success).toBe(false);
      expect(await t.prisma.user.count({ where: { email: body.email } })).toBe(1);
    });

    it('AC-A1-05: a password shorter than 8 characters returns 400', async () => {
      const body = newUser('STUDENT', { password: '1234567' });
      const res = await t.post('/auth/register', { body });
      expect(res.status).toBe(400);
      expect(await t.prisma.user.count({ where: { email: body.email } })).toBe(0);
    });

    it('boundary: a password of exactly 8 characters is accepted', async () => {
      const res = await t.post('/auth/register', {
        body: newUser('STUDENT', { password: '12345678' }),
      });
      expect(res.status).toBe(201);
    });

    it('AC-A1-06: a missing or empty displayName returns 400', async () => {
      const { displayName: _omit, ...withoutName } = newUser('STUDENT');
      expect((await t.post('/auth/register', { body: withoutName })).status).toBe(400);
      expect(
        (await t.post('/auth/register', { body: newUser('STUDENT', { displayName: '' }) })).status,
      ).toBe(400);
    });

    it('an invalid email, an unknown role or an unknown property returns 400', async () => {
      expect(
        (await t.post('/auth/register', { body: newUser('STUDENT', { email: 'not-an-email' }) })).status,
      ).toBe(400);
      expect((await t.post('/auth/register', { body: newUser('ROOT') })).status).toBe(400);
      expect(
        (await t.post('/auth/register', { body: newUser('STUDENT', { isAdmin: true }) })).status,
      ).toBe(400);
    });

    it.todo('OQ-A1-01 (A1 fix): register returns accessToken and refreshToken');
    it.todo('OQ-A1-02 (A1 fix): register with role ADMIN is rejected with 400 and creates no user');
  });

  describe('POST /auth/login', () => {
    it('AC-A2-01: valid credentials return the user and both tokens', async () => {
      const s = await createStudent(t);
      const res = await t.post('/auth/login', {
        body: { email: s.email, password: s.password },
      });
      expect(res.status).toBe(200);
      expect(res.data.user).toMatchObject({ id: s.id, email: s.email, role: 'STUDENT' });
      expect(typeof res.data.accessToken).toBe('string');
      expect(typeof res.data.refreshToken).toBe('string');
      expect(res.raw).not.toMatch(/passwordHash|password_hash/);
    });

    it('AC-A2-02/03: wrong password and unknown email give the same 401 (no enumeration)', async () => {
      const s = await createStudent(t);
      const wrong = await t.post('/auth/login', {
        body: { email: s.email, password: 'wrong-password' },
      });
      const unknown = await t.post('/auth/login', {
        body: { email: 'nobody@example.test', password: 'wrong-password' },
      });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.data).toBeUndefined();
    });
  });

  describe('GET /auth/me', () => {
    it('returns the caller for a valid access token', async () => {
      const teacher = await createTeacher(t);
      const res = await t.get('/auth/me', { token: teacher.token });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        id: teacher.id,
        email: teacher.email,
        role: 'TEACHER',
      });
      expect(res.raw).not.toMatch(/passwordHash|password_hash/);
    });

    it('returns 401 without a token, with a malformed token, and with a refresh token', async () => {
      const s = await createStudent(t);
      expect((await t.get('/auth/me')).status).toBe(401);
      expect((await t.get('/auth/me', { token: 'not.a.jwt' })).status).toBe(401);
      expect((await t.get('/auth/me', { token: s.refreshToken })).status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('AC-A2-04: returns a new token pair and the new access token works', async () => {
      const s = await createStudent(t);
      const res = await t.post('/auth/refresh', { body: { refreshToken: s.refreshToken } });
      expect(res.status).toBe(200);
      expect(res.data.refreshToken).not.toBe(s.refreshToken);
      const me = await t.get('/auth/me', { token: res.data.accessToken });
      expect(me.status).toBe(200);
      expect(me.data.id).toBe(s.id);
    });

    it('AC-A2-05: a rotated refresh token is rejected with 401; the new one still works', async () => {
      const s = await createStudent(t);
      const first = await t.post('/auth/refresh', { body: { refreshToken: s.refreshToken } });
      expect(first.status).toBe(200);

      const replay = await t.post('/auth/refresh', { body: { refreshToken: s.refreshToken } });
      expect(replay.status).toBe(401);

      const second = await t.post('/auth/refresh', {
        body: { refreshToken: first.data.refreshToken },
      });
      expect(second.status).toBe(200);
    });

    it('an unknown refresh token returns 401 and a missing one returns 400', async () => {
      expect(
        (await t.post('/auth/refresh', { body: { refreshToken: 'f'.repeat(80) } })).status,
      ).toBe(401);
      expect((await t.post('/auth/refresh', { body: {} })).status).toBe(400);
    });

    it('concurrency: parallel refreshes of one token leave exactly one successor token', async () => {
      const s = await createStudent(t);
      expect(await t.prisma.refreshToken.count({ where: { userId: s.id } })).toBe(1);
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          t.post('/auth/refresh', { body: { refreshToken: s.refreshToken } }),
        ),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(await t.prisma.refreshToken.count({ where: { userId: s.id } })).toBe(1);
    });

    it.todo(
      'AC-A2-05 (defect, see report): the losers of a parallel refresh get 401, not 500 INTERNAL_ERROR (auth.service.ts refresh: delete of an already-deleted row)',
    );
  });

  describe('POST /auth/logout', () => {
    it('AC-A2-06: deletes the refresh token so it can no longer be used', async () => {
      const s = await createStudent(t);
      const out = await t.post('/auth/logout', {
        token: s.token,
        body: { refreshToken: s.refreshToken },
      });
      expect(out.status).toBe(200);
      expect(await t.prisma.refreshToken.count({ where: { userId: s.id } })).toBe(0);
      const refresh = await t.post('/auth/refresh', { body: { refreshToken: s.refreshToken } });
      expect(refresh.status).toBe(401);
    });

    it('AC-A2-07: repeating the same logout returns 200 (idempotent)', async () => {
      const s = await createStudent(t);
      const body = { refreshToken: s.refreshToken };
      expect((await t.post('/auth/logout', { token: s.token, body })).status).toBe(200);
      expect((await t.post('/auth/logout', { token: s.token, body })).status).toBe(200);
    });

    it('requires authentication', async () => {
      const res = await t.post('/auth/logout', { body: { refreshToken: 'x' } });
      expect(res.status).toBe(401);
    });
  });

  describe('role guard (A5)', () => {
    it('a STUDENT is refused teacher-only endpoints with 403 FORBIDDEN', async () => {
      const s = await createStudent(t);
      const calls = await Promise.all([
        t.post('/classrooms', { token: s.token, body: { name: 'X' } }),
        t.get('/questions', { token: s.token }),
        t.post('/exams', { token: s.token, body: { title: 'X', durationSeconds: 600 } }),
        t.get('/exams', { token: s.token }),
      ]);
      for (const res of calls) {
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.error!.code).toBe('FORBIDDEN');
      }
      expect(await t.prisma.classroom.count({ where: { ownerId: s.id } })).toBe(0);
    });

    it('a TEACHER is refused student-only endpoints with 403', async () => {
      const teacher = await createTeacher(t);
      const calls = await Promise.all([
        t.post('/classrooms/join', { token: teacher.token, body: { joinCode: 'ABCDEF' } }),
        t.get('/attempts/my', { token: teacher.token }),
        t.post('/attempts/start', {
          token: teacher.token,
          body: { examId: '00000000-0000-0000-0000-000000000000' },
        }),
      ]);
      for (const res of calls) expect(res.status).toBe(403);
    });

    it('authentication is checked before the role: no token gives 401, not 403', async () => {
      expect((await t.post('/classrooms', { body: { name: 'X' } })).status).toBe(401);
      expect((await t.get('/questions')).status).toBe(401);
    });
  });
});
