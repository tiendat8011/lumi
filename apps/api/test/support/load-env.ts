// Jest setupFiles entry: runs in the test process before any test module is
// imported, so AppModule and PrismaClient only ever see the test environment.
import { loadTestEnv } from './env';

loadTestEnv();
