import { execFileSync } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_NAME, loadTestEnv, assertTestDatabaseUrl } from './env';

/**
 * Runs once per `jest` invocation:
 * 1. loads test/.env.test and checks the database name,
 * 2. creates the lumi_test database if it does not exist,
 * 3. applies pending migrations with `prisma migrate deploy` (never reset).
 */
export default async function globalSetup(): Promise<void> {
  loadTestEnv();
  const url = assertTestDatabaseUrl();

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({
    datasources: { db: { url: adminUrl.toString() } },
  });
  try {
    const rows = await admin.$queryRawUnsafe<Array<{ datname: string }>>(
      `SELECT datname FROM pg_database WHERE datname = '${TEST_DB_NAME}'`,
    );
    if (rows.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  const apiRoot = path.resolve(__dirname, '..', '..');
  const repoRoot = path.resolve(apiRoot, '..', '..');
  const prismaBin = path.join(repoRoot, 'node_modules', '.bin', 'prisma');
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}
