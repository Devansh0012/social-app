import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://braventex:braventex@localhost:5432/braventex_test?schema=public';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: './tests/global-setup.ts',
    // Suites share one test database; run files sequentially so truncation
    // in one suite can't race another.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_DATABASE_URL: TEST_DATABASE_URL,
      // 'development' (not 'test') so signup returns verifyTokenDev — raw
      // tokens are stored hashed, so tests can't recover them from the DB.
      NODE_ENV: 'development',
      LOG_LEVEL: 'error',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
      RATE_LIMIT_MAX: '100000',
      STORAGE_DRIVER: 'local',
      RESEND_API_KEY: '',
    },
  },
});
