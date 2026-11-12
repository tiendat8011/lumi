import * as fs from 'fs';
import * as path from 'path';

export const TEST_DB_NAME = 'lumi_test';
const ENV_FILE = path.resolve(__dirname, '..', '.env.test');

/**
 * Loads test/.env.test into process.env, overriding existing values, so the
 * developer's apps/api/.env (which points at lumi_dev) can never win.
 */
export function loadTestEnv(): void {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  assertTestDatabaseUrl();
}

/** Refuses to continue unless DATABASE_URL names the lumi_test database. */
export function assertTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  let dbName = '';
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    // fall through to the error below
  }
  if (dbName !== TEST_DB_NAME) {
    throw new Error(
      `E2E tests refuse to run: DATABASE_URL must end in "${TEST_DB_NAME}" ` +
        `but names "${dbName || '(unparseable)'}".`,
    );
  }
  return url;
}
