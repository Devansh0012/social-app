import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createTestApp,
  gql,
  errorCode,
  resetDb,
  seedCollege,
  createUser,
  flushEvents,
  prisma,
} from './helpers.js';

let app: FastifyInstance;
let ada: Awaited<ReturnType<typeof createUser>>;
let bob: Awaited<ReturnType<typeof createUser>>;
let eve: Awaited<ReturnType<typeof createUser>>;
let conversationId: string;

beforeAll(async () => {
  await resetDb();
  await seedCollege();
  app = await createTestApp();
  ada = await createUser(app, 'ada');
  bob = await createUser(app, 'bob');
  eve = await createUser(app, 'eve');
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('direct messages', () => {
  it('opens a conversation and delivers messages with unread counts', async () => {
    const open = await gql<{ openConversation: { id: string } }>(
      app,
      `mutation { openConversation(username: "ada") { id } }`,
      {},
      bob.accessToken,
    );
    conversationId = open.data!.openConversation.id;

    await gql(
      app,
      `mutation($c: ID!) { sendMessage(conversationId: $c, body: "hi ada") { id } }`,
      { c: conversationId },
      bob.accessToken,
    );

    const adaView = await gql<{
      conversations: Array<{ lastMessage: { body: string }; unreadCount: number }>;
      unreadDMCount: number;
    }>(
      app,
      `{ conversations { lastMessage { body } unreadCount } unreadDMCount }`,
      {},
      ada.accessToken,
    );
    expect(adaView.data?.conversations[0]?.lastMessage.body).toBe('hi ada');
    expect(adaView.data?.conversations[0]?.unreadCount).toBe(1);
    expect(adaView.data?.unreadDMCount).toBe(1);

    const marked = await gql<{ markConversationRead: boolean }>(
      app,
      `mutation($c: ID!) { markConversationRead(conversationId: $c) }`,
      { c: conversationId },
      ada.accessToken,
    );
    expect(marked.data?.markConversationRead).toBe(true);

    const after = await gql<{ unreadDMCount: number }>(app, `{ unreadDMCount }`, {}, ada.accessToken);
    expect(after.data?.unreadDMCount).toBe(0);
  });

  it('forbids non-participants from reading a conversation', async () => {
    const res = await gql(
      app,
      `query($c: ID!) { messages(conversationId: $c, first: 5) { nodes { body } } }`,
      { c: conversationId },
      eve.accessToken,
    );
    expect(errorCode(res)).toBe('FORBIDDEN');
  });
});

describe('notifications', () => {
  it('every emitted notification type is representable in the GraphQL enum', async () => {
    // Regression: NEW_FOLLOWER/NEW_DM were missing from the schema enum, which
    // made the whole notifications query fail once such a row existed.
    await gql(app, `mutation { followUser(username: "ada") { username } }`, {}, bob.accessToken);
    const post = await gql<{ createPost: { id: string } }>(
      app,
      `mutation { createPost(input: { type: TEXT, title: "notif", body: "x" }) { id } }`,
      {},
      ada.accessToken,
    );
    await gql(app, `mutation($p: ID!) { likePost(postId: $p) { id } }`, { p: post.data!.createPost.id }, bob.accessToken);
    await gql(
      app,
      `mutation($p: ID!) { addComment(input: { postId: $p, body: "c" }) { id } }`,
      { p: post.data!.createPost.id },
      bob.accessToken,
    );
    await flushEvents();

    const res = await gql<{
      notifications: Array<{ type: string; actor: { username: string } | null }>;
      unreadNotificationCount: number;
    }>(
      app,
      `{ notifications(limit: 20) { type actor { username } } unreadNotificationCount }`,
      {},
      ada.accessToken,
    );
    expect(res.errors).toBeUndefined();
    const types = res.data!.notifications.map((n) => n.type);
    expect(types).toContain('NEW_FOLLOWER');
    expect(types).toContain('NEW_DM');
    expect(types).toContain('POST_LIKE');
    expect(types).toContain('POST_COMMENT');
  });

  it('markAllNotificationsRead clears the unread count', async () => {
    const before = await gql<{ unreadNotificationCount: number }>(
      app,
      `{ unreadNotificationCount }`,
      {},
      ada.accessToken,
    );
    expect(before.data!.unreadNotificationCount).toBeGreaterThan(0);

    await gql(app, `mutation { markAllNotificationsRead }`, {}, ada.accessToken);
    const after = await gql<{ unreadNotificationCount: number }>(
      app,
      `{ unreadNotificationCount }`,
      {},
      ada.accessToken,
    );
    expect(after.data?.unreadNotificationCount).toBe(0);
  });

  it('does not notify on self-actions', async () => {
    const post = await gql<{ createPost: { id: string } }>(
      app,
      `mutation { createPost(input: { type: TEXT, title: "self", body: "x" }) { id } }`,
      {},
      eve.accessToken,
    );
    await gql(app, `mutation($p: ID!) { likePost(postId: $p) { id } }`, { p: post.data!.createPost.id }, eve.accessToken);
    await flushEvents();

    const res = await gql<{ notifications: Array<{ type: string }> }>(
      app,
      `{ notifications(limit: 10) { type } }`,
      {},
      eve.accessToken,
    );
    expect(res.data?.notifications).toHaveLength(0);
  });
});
