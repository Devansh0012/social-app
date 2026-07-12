import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, gql, errorCode, resetDb, seedCollege, createUser, prisma } from './helpers.js';

let app: FastifyInstance;
let creator: Awaited<ReturnType<typeof createUser>>;
let member: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;
let communityId: string;

beforeAll(async () => {
  await resetDb();
  await seedCollege();
  app = await createTestApp();
  creator = await createUser(app, 'creator');
  member = await createUser(app, 'member');
  admin = await createUser(app, 'admin', { admin: true });
  const res = await gql<{ createCommunity: { id: string } }>(
    app,
    `mutation { createCommunity(input: { name: "Test Community", description: "d" }) { id } }`,
    {},
    creator.accessToken,
  );
  communityId = res.data!.createCommunity.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('communities', () => {
  it('join is idempotent and leave decrements membership', async () => {
    const join = `mutation($c: ID!) { joinCommunity(communityId: $c) { memberCount viewerMembership { role } } }`;
    const first = await gql<{ joinCommunity: { memberCount: number } }>(app, join, { c: communityId }, member.accessToken);
    const again = await gql<{ joinCommunity: { memberCount: number } }>(app, join, { c: communityId }, member.accessToken);
    expect(first.data?.joinCommunity.memberCount).toBe(2);
    expect(again.data?.joinCommunity.memberCount).toBe(2);

    const left = await gql<{ leaveCommunity: { memberCount: number; viewerMembership: null } }>(
      app,
      `mutation($c: ID!) { leaveCommunity(communityId: $c) { memberCount viewerMembership { role } } }`,
      { c: communityId },
      member.accessToken,
    );
    expect(left.data?.leaveCommunity.memberCount).toBe(1);
    expect(left.data?.leaveCommunity.viewerMembership).toBeNull();
  });

  it('creators cannot leave without transferring ownership', async () => {
    const res = await gql(
      app,
      `mutation($c: ID!) { leaveCommunity(communityId: $c) { id } }`,
      { c: communityId },
      creator.accessToken,
    );
    expect(errorCode(res)).toBe('FORBIDDEN');
    expect(res.errors?.[0]?.message).toContain('transfer ownership');
  });

  it('postCount tracks create, delete, and admin moderation', async () => {
    const count = async () => {
      const r = await gql<{ community: { postCount: number } }>(
        app,
        `query($c: String!) { community(slug: $c) { postCount } }`,
        { c: 'test-community' },
        creator.accessToken,
      );
      return r.data?.community.postCount;
    };

    expect(await count()).toBe(0);

    const p1 = await gql<{ createPost: { id: string } }>(
      app,
      `mutation($c: ID!) { createPost(input: { type: TEXT, title: "a", body: "x", communityId: $c }) { id } }`,
      { c: communityId },
      creator.accessToken,
    );
    const p2 = await gql<{ createPost: { id: string } }>(
      app,
      `mutation($c: ID!) { createPost(input: { type: TEXT, title: "b", body: "x", communityId: $c }) { id } }`,
      { c: communityId },
      creator.accessToken,
    );
    expect(await count()).toBe(2);

    await gql(app, `mutation($p: ID!) { deletePost(postId: $p) }`, { p: p1.data!.createPost.id }, creator.accessToken);
    expect(await count()).toBe(1);

    await gql(app, `mutation($p: ID!) { removePost(postId: $p) { id } }`, { p: p2.data!.createPost.id }, admin.accessToken);
    expect(await count()).toBe(0);
  });
});
