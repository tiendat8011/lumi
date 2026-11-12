import { createTestApp, TestApp } from './support/app';
import { assertTestDatabaseUrl } from './support/env';

describe('harness smoke', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await t.truncateAll();
  });

  afterAll(async () => {
    await t.close();
  });

  it('runs against lumi_test, never the dev database', async () => {
    expect(process.env.DATABASE_URL).toMatch(/\/lumi_test$/);
    const rows = await t.prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    expect(rows[0].db).toBe('lumi_test');
  });

  it('the guard rejects any other database name', () => {
    const saved = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgresql://lumi:x@localhost:5433/lumi_dev';
      expect(() => assertTestDatabaseUrl()).toThrow(/refuse to run/);
      process.env.DATABASE_URL = 'postgresql://lumi:x@localhost:5433/lumi_test_copy';
      expect(() => assertTestDatabaseUrl()).toThrow(/refuse to run/);
    } finally {
      process.env.DATABASE_URL = saved;
    }
  });

  it('GET /api/health is public and wrapped by the transform interceptor', async () => {
    const res = await t.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('an unknown route returns the error envelope from the exception filter', async () => {
    const res = await t.get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('a protected route without a token returns 401 in the error envelope', async () => {
    const res = await t.get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    });
  });

  it('the validation pipe rejects unknown properties (forbidNonWhitelisted)', async () => {
    const res = await t.post('/auth/login', {
      body: { email: 'a@example.com', password: 'x', extra: 1 },
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it.todo(
    'defect, see report: a 500 response never contains Prisma error text, file paths or source lines (http-exception.filter.ts returns exception.message for non-HTTP errors)',
  );
  it.todo(
    'defect, see report: a malformed (non-UUID) id in a path such as GET /classrooms/not-a-uuid returns 400 or 404, not 500',
  );
});
