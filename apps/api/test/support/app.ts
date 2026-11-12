import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../../src/database/prisma.service';
import { assertTestDatabaseUrl, TEST_DB_NAME } from './env';

export interface ApiResponse<T = any> {
  status: number;
  /** Parsed JSON body ({success, data, meta} or {success:false, error}); null when empty. */
  body: any;
  /** Shortcut for body.data. */
  data: T;
  /** Shortcut for body.error. */
  error: { code: string; message: string } | undefined;
  headers: Record<string, unknown>;
  /** Raw payload, for non-JSON responses such as CSV or file downloads. */
  raw: string;
  rawBuffer: Buffer;
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
}

export interface TestApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
  request(method: string, url: string, opts?: RequestOptions): Promise<ApiResponse>;
  get(url: string, opts?: RequestOptions): Promise<ApiResponse>;
  post(url: string, opts?: RequestOptions): Promise<ApiResponse>;
  patch(url: string, opts?: RequestOptions): Promise<ApiResponse>;
  put(url: string, opts?: RequestOptions): Promise<ApiResponse>;
  delete(url: string, opts?: RequestOptions): Promise<ApiResponse>;
  /** Removes every row from every application table (not _prisma_migrations). */
  truncateAll(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Boots the real AppModule on Fastify with the same global prefix, pipe,
 * filter and interceptor as src/main.ts. Requests go through Fastify's
 * inject(), so no TCP port is bound. URLs are given without the /api prefix.
 *
 * KEEP IN SYNC with src/main.ts: main.ts applies these globally outside
 * AppModule, so a change there is not picked up here automatically.
 */
export async function createTestApp(): Promise<TestApp> {
  assertTestDatabaseUrl();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);

  // Second line of defence: ask the server which database we are connected to.
  const [{ db }] = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
    'SELECT current_database() AS db',
  );
  if (db !== TEST_DB_NAME) {
    await app.close();
    throw new Error(`E2E tests connected to "${db}", expected "${TEST_DB_NAME}".`);
  }

  const request = async (
    method: string,
    url: string,
    opts: RequestOptions = {},
  ): Promise<ApiResponse> => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const res = await app.inject({
      method: method as any,
      url: `/api${url}`,
      headers,
      ...(opts.query && {
        query: Object.fromEntries(
          Object.entries(opts.query).map(([k, v]) => [k, String(v)]),
        ),
      }),
      ...(opts.body !== undefined && { payload: opts.body as any }),
    });
    let body: any = null;
    try {
      body = res.payload ? JSON.parse(res.payload) : null;
    } catch {
      body = null;
    }
    return {
      status: res.statusCode,
      body,
      data: body?.data,
      error: body?.error,
      headers: res.headers as Record<string, unknown>,
      raw: res.payload,
      rawBuffer: res.rawPayload,
    };
  };

  const truncateAll = async (): Promise<void> => {
    const [{ db: current }] = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    if (current !== TEST_DB_NAME) {
      throw new Error(`Refusing to truncate database "${current}".`);
    }
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (tables.length === 0) return;
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  };

  return {
    app,
    prisma,
    request,
    get: (url, opts) => request('GET', url, opts),
    post: (url, opts) => request('POST', url, opts),
    patch: (url, opts) => request('PATCH', url, opts),
    put: (url, opts) => request('PUT', url, opts),
    delete: (url, opts) => request('DELETE', url, opts),
    truncateAll,
    close: () => app.close(),
  };
}
