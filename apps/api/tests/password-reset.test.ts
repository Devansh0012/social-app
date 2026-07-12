import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, gql, errorCode, resetDb, seedCollege, createUser, prisma } from './helpers.js';

let app: FastifyInstance;
let user: Awaited<ReturnType<typeof createUser>>;

const REQUEST = `mutation($e: String!) { requestPasswordReset(email: $e) { ok resetTokenDev } }`;
const RESET = `mutation($t: String!, $p: String!) { resetPassword(token: $t, newPassword: $p) }`;

beforeAll(async () => {
  await resetDb();
  await seedCollege();
  app = await createTestApp();
  user = await createUser(app, 'forgetful');
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('password reset', () => {
  it('does not reveal whether an email has an account', async () => {
    const res = await gql<{ requestPasswordReset: { ok: boolean; resetTokenDev: null } }>(
      app,
      REQUEST,
      { e: 'nobody@braventex.dev' },
    );
    expect(res.data?.requestPasswordReset.ok).toBe(true);
    expect(res.data?.requestPasswordReset.resetTokenDev).toBeNull();
  });

  it('resets the password, revokes all sessions, and allows the new login', async () => {
    const req = await gql<{ requestPasswordReset: { resetTokenDev: string } }>(
      app,
      REQUEST,
      { e: user.email },
    );
    const token = req.data!.requestPasswordReset.resetTokenDev;
    expect(token).toBeTruthy();

    const reset = await gql<{ resetPassword: boolean }>(app, RESET, {
      t: token,
      p: 'NewPassword456!',
    });
    expect(reset.data?.resetPassword).toBe(true);

    // Old password no longer works…
    const oldLogin = await gql(
      app,
      `mutation($e: String!) { login(input: { email: $e, password: "Password123!" }) { viewer { id } } }`,
      { e: user.email },
    );
    expect(errorCode(oldLogin)).toBe('UNAUTHENTICATED');

    // …the new one does…
    const newLogin = await gql<{ login: { viewer: { id: string } } }>(
      app,
      `mutation($e: String!) { login(input: { email: $e, password: "NewPassword456!" }) { viewer { id } } }`,
      { e: user.email },
    );
    expect(newLogin.data?.login.viewer.id).toBe(user.id);

    // …and every pre-reset refresh token is revoked (logged out everywhere).
    const refresh = await gql(
      app,
      `mutation($r: String!) { refresh(refreshToken: $r) { viewer { id } } }`,
      { r: user.refreshToken },
    );
    expect(errorCode(refresh)).toBe('UNAUTHENTICATED');
  });

  it('rejects reused, bogus, and weak-password attempts', async () => {
    const req = await gql<{ requestPasswordReset: { resetTokenDev: string } }>(
      app,
      REQUEST,
      { e: user.email },
    );
    const token = req.data!.requestPasswordReset.resetTokenDev;

    const weak = await gql(app, RESET, { t: token, p: 'short' });
    expect(errorCode(weak)).toBe('VALIDATION');

    await gql(app, RESET, { t: token, p: 'AnotherPass789!' });
    const reuse = await gql(app, RESET, { t: token, p: 'YetAnother000!' });
    expect(errorCode(reuse)).toBe('BAD_REQUEST');
    expect(reuse.errors?.[0]?.message).toContain('already been used');

    const bogus = await gql(app, RESET, { t: 'not-a-token', p: 'ValidPass123!' });
    expect(errorCode(bogus)).toBe('BAD_REQUEST');
  });
});
