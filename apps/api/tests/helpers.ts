import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/core/prisma.js';

export { prisma };

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

interface GqlResult<T> {
  data: T | null;
  errors?: Array<{ message: string; extensions?: { code?: string; statusCode?: number } }>;
}

export async function gql<T = Record<string, unknown>>(
  app: FastifyInstance,
  query: string,
  variables: Record<string, unknown> = {},
  token?: string | null,
): Promise<GqlResult<T>> {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    payload: { query, variables },
  });
  return res.json() as GqlResult<T>;
}

/** First GraphQL error code, or null. */
export function errorCode<T>(result: GqlResult<T>): string | null {
  return result.errors?.[0]?.extensions?.code ?? null;
}

/** Truncate every app table so each suite starts from a clean slate. */
export async function resetDb(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

export async function seedCollege() {
  return prisma.college.upsert({
    where: { domain: 'braventex.dev' },
    update: {},
    create: { name: 'Braventex Dev University', domain: 'braventex.dev', country: 'XX' },
  });
}

interface TestUser {
  id: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  email: string;
}

/** Signup + verify email + complete onboarding via the real GraphQL surface. */
export async function createUser(
  app: FastifyInstance,
  handle: string,
  opts: { admin?: boolean } = {},
): Promise<TestUser> {
  const email = `${handle}@braventex.dev`;
  const signup = await gql<{
    signup: {
      viewer: { id: string; username: string };
      tokens: { accessToken: string; refreshToken: string };
      verifyTokenDev: string;
    };
  }>(
    app,
    `mutation($e: String!, $n: String!, $u: String!) {
      signup(input: { email: $e, password: "Password123!", fullName: $n, username: $u }) {
        viewer { id username }
        tokens { accessToken refreshToken }
        verifyTokenDev
      }
    }`,
    { e: email, n: `Test ${handle}`, u: handle },
  );
  if (!signup.data) throw new Error(`signup failed: ${JSON.stringify(signup.errors)}`);
  const { viewer, tokens, verifyTokenDev } = signup.data.signup;

  const verified = await gql(
    app,
    `mutation($t: String!) { verifyEmail(token: $t) { id emailVerified } }`,
    { t: verifyTokenDev },
    tokens.accessToken,
  );
  if (verified.errors) throw new Error(`verifyEmail failed: ${JSON.stringify(verified.errors)}`);
  const onboarded = await gql(
    app,
    `mutation($u: String!) { completeOnboarding(input: { username: $u, department: "CS", graduationYear: 2027, interests: ["testing"], skills: ["ts"] }) { id onboardingCompleted } }`,
    { u: handle },
    tokens.accessToken,
  );
  if (onboarded.errors) throw new Error(`onboarding failed: ${JSON.stringify(onboarded.errors)}`);

  if (opts.admin) {
    await prisma.user.update({ where: { id: viewer.id }, data: { role: 'ADMIN' } });
    // Role is baked into the access token — re-login to pick it up.
    const login = await gql<{
      login: { tokens: { accessToken: string; refreshToken: string } };
    }>(
      app,
      `mutation($e: String!) { login(input: { email: $e, password: "Password123!" }) { tokens { accessToken refreshToken } } }`,
      { e: email },
    );
    if (!login.data) throw new Error('admin re-login failed');
    tokens.accessToken = login.data.login.tokens.accessToken;
    tokens.refreshToken = login.data.login.tokens.refreshToken;
  }

  return {
    id: viewer.id,
    username: viewer.username,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    email,
  };
}

/** Wait for fire-and-forget eventBus listeners (notifications) to finish. */
export async function flushEvents(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
