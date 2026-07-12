import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, gql, errorCode, resetDb, seedCollege, createUser, prisma } from './helpers.js';

let app: FastifyInstance;
let host: Awaited<ReturnType<typeof createUser>>;
let guest: Awaited<ReturnType<typeof createUser>>;
let roomId: string;

beforeAll(async () => {
  await resetDb();
  await seedCollege();
  app = await createTestApp();
  host = await createUser(app, 'host');
  guest = await createUser(app, 'guest');
  const res = await gql<{ createStudyRoom: { id: string } }>(
    app,
    `mutation { createStudyRoom(input: { name: "Focus", topic: "t", maxParticipants: 5 }) { id } }`,
    {},
    host.accessToken,
  );
  roomId = res.data!.createStudyRoom.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('study rooms', () => {
  it('requires joining before chatting', async () => {
    const before = await gql(
      app,
      `mutation($r: ID!) { sendStudyRoomMessage(roomId: $r, body: "hi") { id } }`,
      { r: roomId },
      guest.accessToken,
    );
    expect(errorCode(before)).toBe('FORBIDDEN');

    await gql(app, `mutation($r: ID!) { joinStudyRoom(roomId: $r) { id } }`, { r: roomId }, guest.accessToken);
    const after = await gql<{ sendStudyRoomMessage: { body: string; author: { username: string } } }>(
      app,
      `mutation($r: ID!) { sendStudyRoomMessage(roomId: $r, body: "hi") { body author { username } } }`,
      { r: roomId },
      guest.accessToken,
    );
    expect(after.data?.sendStudyRoomMessage.body).toBe('hi');
    expect(after.data?.sendStudyRoomMessage.author.username).toBe('guest');
  });

  it('leaving revokes chat access (soft-leave respected)', async () => {
    await gql(app, `mutation($r: ID!) { leaveStudyRoom(roomId: $r) { id } }`, { r: roomId }, guest.accessToken);
    const res = await gql(
      app,
      `mutation($r: ID!) { sendStudyRoomMessage(roomId: $r, body: "still here?") { id } }`,
      { r: roomId },
      guest.accessToken,
    );
    expect(errorCode(res)).toBe('FORBIDDEN');
  });

  it('only the creator controls the pomodoro', async () => {
    await gql(app, `mutation($r: ID!) { joinStudyRoom(roomId: $r) { id } }`, { r: roomId }, guest.accessToken);
    const denied = await gql(
      app,
      `mutation($r: ID!) { startPomodoro(roomId: $r, phase: FOCUS, durationSeconds: 300) { phase } }`,
      { r: roomId },
      guest.accessToken,
    );
    expect(errorCode(denied)).toBe('FORBIDDEN');

    const started = await gql<{ startPomodoro: { phase: string; cycle: number } }>(
      app,
      `mutation($r: ID!) { startPomodoro(roomId: $r, phase: FOCUS, durationSeconds: 300) { phase cycle } }`,
      { r: roomId },
      host.accessToken,
    );
    expect(started.data?.startPomodoro.phase).toBe('FOCUS');

    const stopped = await gql<{ stopPomodoro: { phase: string } }>(
      app,
      `mutation($r: ID!) { stopPomodoro(roomId: $r) { phase } }`,
      { r: roomId },
      host.accessToken,
    );
    expect(stopped.data?.stopPomodoro.phase).toBe('IDLE');
  });
});
