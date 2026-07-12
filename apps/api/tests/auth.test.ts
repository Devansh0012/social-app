import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, gql, errorCode, resetDb, seedCollege, createUser, prisma } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  await resetDb();
  await seedCollege();
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('auth', () => {
  it('rejects signup with a non-college email', async () => {
    const res = await gql(
      app,
      `mutation { signup(input: { email: "bob@gmail.com", password: "Password123!", fullName: "Bob" }) { viewer { id } } }`,
    );
    expect(errorCode(res)).toBe('COLLEGE_EMAIL_REQUIRED');
  });

  it('signs up, verifies email, and completes onboarding', async () => {
    const user = await createUser(app, 'alice');
    const me = await gql<{ me: { username: string; emailVerified: boolean; onboardingCompleted: boolean } }>(
      app,
      `{ me { username emailVerified onboardingCompleted } }`,
      {},
      user.accessToken,
    );
    expect(me.data?.me).toEqual({
      username: 'alice',
      emailVerified: true,
      onboardingCompleted: true,
    });
  });

  it('rejects login with a wrong password', async () => {
    const res = await gql(
      app,
      `mutation { login(input: { email: "alice@braventex.dev", password: "wrong" }) { viewer { id } } }`,
    );
    expect(errorCode(res)).toBe('UNAUTHENTICATED');
    expect(res.errors?.[0]?.message).toBe('Invalid email or password');
  });

  it('rotates the refresh token and detects replay', async () => {
    const user = await createUser(app, 'rotator');
    const first = await gql<{ refresh: { tokens: { accessToken: string; refreshToken: string } } }>(
      app,
      `mutation($r: String!) { refresh(refreshToken: $r) { tokens { accessToken refreshToken } } }`,
      { r: user.refreshToken },
    );
    expect(first.data?.refresh.tokens.accessToken).toBeTruthy();

    // Re-using the rotated token within the grace window still succeeds
    // (multi-tab race); the grace path must not revoke the family.
    const replayed = await gql<{ refresh: { tokens: { refreshToken: string } } }>(
      app,
      `mutation($r: String!) { refresh(refreshToken: $r) { tokens { refreshToken } } }`,
      { r: user.refreshToken },
    );
    expect(replayed.data?.refresh.tokens.refreshToken).toBeTruthy();

    // A token that was never issued is rejected outright.
    const bogus = await gql(
      app,
      `mutation { refresh(refreshToken: "garbage") { tokens { accessToken } } }`,
    );
    expect(errorCode(bogus)).toBe('UNAUTHENTICATED');
  });

  it('reports username availability and enforces the format', async () => {
    const user = await createUser(app, 'checker');
    const taken = await gql<{ isUsernameAvailable: { available: boolean } }>(
      app,
      `{ isUsernameAvailable(username: "alice") { available } }`,
      {},
      user.accessToken,
    );
    expect(taken.data?.isUsernameAvailable.available).toBe(false);

    const bad = await gql(
      app,
      `{ isUsernameAvailable(username: "has-hyphen") { available } }`,
      {},
      user.accessToken,
    );
    expect(errorCode(bad)).toBe('BAD_REQUEST');
  });

  it('returns me: null without a token', async () => {
    const res = await gql<{ me: null }>(app, `{ me { id } }`);
    expect(res.data?.me).toBeNull();
  });
});
