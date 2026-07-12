import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, gql, errorCode, resetDb, seedCollege, createUser, prisma } from './helpers.js';

let app: FastifyInstance;
let ada: Awaited<ReturnType<typeof createUser>>;
let bob: Awaited<ReturnType<typeof createUser>>;
let postId: string;

beforeAll(async () => {
  await resetDb();
  await seedCollege();
  app = await createTestApp();
  ada = await createUser(app, 'ada');
  bob = await createUser(app, 'bob');
  const res = await gql<{ createPost: { id: string } }>(
    app,
    `mutation { createPost(input: { type: TEXT, title: "hello", body: "world" }) { id } }`,
    {},
    ada.accessToken,
  );
  postId = res.data!.createPost.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('posts', () => {
  it('requires community membership to post into a community', async () => {
    const community = await gql<{ createCommunity: { id: string } }>(
      app,
      `mutation { createCommunity(input: { name: "Members Only" }) { id } }`,
      {},
      ada.accessToken,
    );
    const cid = community.data!.createCommunity.id;
    const res = await gql(
      app,
      `mutation($c: ID!) { createPost(input: { type: TEXT, title: "x", body: "y", communityId: $c }) { id } }`,
      { c: cid },
      bob.accessToken,
    );
    expect(errorCode(res)).toBe('FORBIDDEN');
  });

  it('likes are idempotent and unlike restores the count', async () => {
    const like = `mutation($p: ID!) { likePost(postId: $p) { likeCount viewerHasLiked } }`;
    const first = await gql<{ likePost: { likeCount: number } }>(app, like, { p: postId }, bob.accessToken);
    const second = await gql<{ likePost: { likeCount: number } }>(app, like, { p: postId }, bob.accessToken);
    expect(first.data?.likePost.likeCount).toBe(1);
    expect(second.data?.likePost.likeCount).toBe(1);

    const unliked = await gql<{ unlikePost: { likeCount: number; viewerHasLiked: boolean } }>(
      app,
      `mutation($p: ID!) { unlikePost(postId: $p) { likeCount viewerHasLiked } }`,
      { p: postId },
      bob.accessToken,
    );
    expect(unliked.data?.unlikePost).toEqual({ likeCount: 0, viewerHasLiked: false });
  });

  it('only the author can edit or delete a post', async () => {
    const edit = await gql(
      app,
      `mutation($p: ID!) { updatePost(postId: $p, input: { body: "hijacked" }) { id } }`,
      { p: postId },
      bob.accessToken,
    );
    expect(errorCode(edit)).toBe('FORBIDDEN');

    const del = await gql(app, `mutation($p: ID!) { deletePost(postId: $p) }`, { p: postId }, bob.accessToken);
    expect(errorCode(del)).toBe('FORBIDDEN');
  });

  it('only the author can edit a comment', async () => {
    const comment = await gql<{ addComment: { id: string } }>(
      app,
      `mutation($p: ID!) { addComment(input: { postId: $p, body: "nice" }) { id } }`,
      { p: postId },
      bob.accessToken,
    );
    const cid = comment.data!.addComment.id;

    const hijack = await gql(
      app,
      `mutation($c: ID!) { updateComment(commentId: $c, body: "hijack") { id } }`,
      { c: cid },
      ada.accessToken,
    );
    expect(errorCode(hijack)).toBe('FORBIDDEN');

    const own = await gql<{ updateComment: { body: string } }>(
      app,
      `mutation($c: ID!) { updateComment(commentId: $c, body: "nice (edited)") { body } }`,
      { c: cid },
      bob.accessToken,
    );
    expect(own.data?.updateComment.body).toBe('nice (edited)');
  });

  it('paginates the global feed by cursor and tolerates garbage cursors', async () => {
    for (let i = 0; i < 3; i++) {
      await gql(
        app,
        `mutation { createPost(input: { type: TEXT, title: "page ${i}", body: "x" }) { id } }`,
        {},
        ada.accessToken,
      );
    }
    const page1 = await gql<{ feed: { nodes: Array<{ id: string }>; pageInfo: { endCursor: string; hasNextPage: boolean } } }>(
      app,
      `{ feed(kind: GLOBAL, first: 2) { nodes { id } pageInfo { endCursor hasNextPage } } }`,
      {},
      ada.accessToken,
    );
    expect(page1.data?.feed.nodes).toHaveLength(2);
    expect(page1.data?.feed.pageInfo.hasNextPage).toBe(true);

    const page2 = await gql<{ feed: { nodes: Array<{ id: string }> } }>(
      app,
      `query($a: String) { feed(kind: GLOBAL, first: 2, after: $a) { nodes { id } } }`,
      { a: page1.data!.feed.pageInfo.endCursor },
      ada.accessToken,
    );
    const ids1 = page1.data!.feed.nodes.map((n) => n.id);
    const ids2 = page2.data!.feed.nodes.map((n) => n.id);
    expect(ids2.some((id) => ids1.includes(id))).toBe(false);

    // A malformed cursor behaves like no cursor instead of erroring.
    const garbage = await gql<{ feed: { nodes: unknown[] } }>(
      app,
      `{ feed(kind: GLOBAL, first: 2, after: "not-a-cursor") { nodes { id } } }`,
      {},
      ada.accessToken,
    );
    expect(garbage.errors).toBeUndefined();
    expect(garbage.data?.feed.nodes).toHaveLength(2);
  });

  it('deleted posts disappear from post(id)', async () => {
    const res = await gql<{ createPost: { id: string } }>(
      app,
      `mutation { createPost(input: { type: TEXT, title: "bye", body: "x" }) { id } }`,
      {},
      ada.accessToken,
    );
    const id = res.data!.createPost.id;
    await gql(app, `mutation($p: ID!) { deletePost(postId: $p) }`, { p: id }, ada.accessToken);
    const gone = await gql<{ post: null }>(app, `query($p: ID!) { post(id: $p) { id } }`, { p: id }, ada.accessToken);
    expect(gone.data?.post).toBeNull();
  });
});
