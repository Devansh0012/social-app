import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, gql, errorCode, resetDb, seedCollege, createUser, prisma } from './helpers.js';

let app: FastifyInstance;
let admin: Awaited<ReturnType<typeof createUser>>;
let target: Awaited<ReturnType<typeof createUser>>;

beforeAll(async () => {
  await resetDb();
  await seedCollege();
  app = await createTestApp();
  admin = await createUser(app, 'admin', { admin: true });
  target = await createUser(app, 'target');
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('admin & ban enforcement', () => {
  it('rejects admin queries from regular users', async () => {
    const res = await gql(
      app,
      `{ adminUsers(first: 5) { nodes { id } } }`,
      {},
      target.accessToken,
    );
    expect(errorCode(res)).toBe('FORBIDDEN');
  });

  it('bans block writes on a still-valid access token', async () => {
    // Regression: access tokens are stateless; before the context-level
    // status check, a banned user kept full access until token expiry.
    await gql(
      app,
      `mutation($u: ID!) { banUser(userId: $u, reason: "test") { status } }`,
      { u: target.id },
      admin.accessToken,
    );

    const write = await gql(
      app,
      `mutation { createPost(input: { type: TEXT, title: "banned", body: "x" }) { id } }`,
      {},
      target.accessToken,
    );
    expect(errorCode(write)).toBe('ACCOUNT_BANNED');

    const login = await gql(
      app,
      `mutation { login(input: { email: "target@braventex.dev", password: "Password123!" }) { viewer { id } } }`,
    );
    expect(errorCode(login)).toBe('ACCOUNT_BANNED');

    const refresh = await gql(
      app,
      `mutation($r: String!) { refresh(refreshToken: $r) { viewer { id } } }`,
      { r: target.refreshToken },
    );
    expect(errorCode(refresh)).toBe('ACCOUNT_BANNED');
  });

  it('unban restores access', async () => {
    await gql(
      app,
      `mutation($u: ID!) { unbanUser(userId: $u) { status } }`,
      { u: target.id },
      admin.accessToken,
    );
    const write = await gql<{ createPost: { id: string } }>(
      app,
      `mutation { createPost(input: { type: TEXT, title: "back", body: "x" }) { id } }`,
      {},
      target.accessToken,
    );
    expect(write.errors).toBeUndefined();
    expect(write.data?.createPost.id).toBeTruthy();
  });

  it('reports flow: create then resolve', async () => {
    const post = await gql<{ createPost: { id: string } }>(
      app,
      `mutation { createPost(input: { type: TEXT, title: "r", body: "x" }) { id } }`,
      {},
      target.accessToken,
    );
    const report = await gql<{ createReport: { id: string; status: string } }>(
      app,
      `mutation($t: ID!) { createReport(input: { targetType: POST, targetId: $t, reason: "spam" }) { id status } }`,
      { t: post.data!.createPost.id },
      target.accessToken,
    );
    expect(report.data?.createReport.status).toBe('OPEN');

    const resolved = await gql<{ resolveReport: { status: string } }>(
      app,
      `mutation($r: ID!) { resolveReport(id: $r, resolution: "dismissed", status: DISMISSED) { status } }`,
      { r: report.data!.createReport.id },
      admin.accessToken,
    );
    expect(resolved.data?.resolveReport.status).toBe('DISMISSED');
  });
});
