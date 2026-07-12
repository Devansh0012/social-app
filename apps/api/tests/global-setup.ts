import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prismaBin = path.join(apiRoot, 'node_modules', '.bin', 'prisma');
const schemaPath = path.join(apiRoot, 'prisma', 'schema.prisma');

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://braventex:braventex@localhost:5432/braventex_test?schema=public';

// Prisma CLI loads apps/api/.env and lets it beat the process environment,
// so every prisma command here runs from a cwd with no .env in sight.
const cleanCwd = os.tmpdir();
const env = {
  ...process.env,
  DATABASE_URL: TEST_DATABASE_URL,
  DIRECT_DATABASE_URL: TEST_DATABASE_URL,
};

export default function setup() {
  // Create the test database if it doesn't exist. CREATE DATABASE can't run
  // inside a transaction, but `prisma db execute` runs scripts directly.
  // Ignore failure: either the DB already exists, or (in CI) the service
  // container was created as the test DB and there's no admin DB to reach —
  // `migrate deploy` below surfaces real problems.
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/braventex';
  try {
    execSync(`"${prismaBin}" db execute --url "${adminUrl}" --stdin`, {
      cwd: cleanCwd,
      env,
      input: 'CREATE DATABASE braventex_test;',
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch {
    // DB already exists or no admin DB — fine either way.
  }

  execSync(`"${prismaBin}" migrate deploy --schema "${schemaPath}"`, {
    cwd: cleanCwd,
    env,
    stdio: 'inherit',
  });
}
