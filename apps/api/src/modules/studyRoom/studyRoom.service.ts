import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { Forbidden, NotFound, Validation } from '../../core/errors.js';
import { eventBus } from '../../core/events/event-bus.js';
import { roomChannel, wsManager } from '../../core/ws/ws-manager.js';

const CreateRoomSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().max(280).optional(),
  topic: z.string().max(80).optional(),
  maxParticipants: z.number().int().min(2).max(100).default(20),
});

const ChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

/**
 * Pomodoro state — server-authoritative so newly joining clients see the
 * same countdown as everyone else. Phase ends are computed from `startedAt`
 * + `durationSeconds`; we never store "time remaining".
 */
export interface PomodoroState {
  phase: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK' | 'IDLE';
  startedAt: string | null;
  durationSeconds: number;
  cycle: number;
}

const DEFAULT_POMODORO: PomodoroState = {
  phase: 'IDLE',
  startedAt: null,
  durationSeconds: 25 * 60,
  cycle: 0,
};

export class StudyRoomService {
  async create(creatorId: string, rawInput: unknown) {
    const parsed = CreateRoomSchema.safeParse(rawInput);
    if (!parsed.success) throw Validation('Invalid input', parsed.error.flatten());

    return prisma.$transaction(async (tx) => {
      const room = await tx.studyRoom.create({
        data: {
          creatorId,
          name: parsed.data.name,
          description: parsed.data.description,
          topic: parsed.data.topic,
          maxParticipants: parsed.data.maxParticipants,
          pomodoroState: { ...DEFAULT_POMODORO } as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.studyRoomMember.create({ data: { roomId: room.id, userId: creatorId } });
      return room;
    });
  }

  async listActive() {
    return prisma.studyRoom.findMany({
      where: { isActive: true, closedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getById(id: string) {
    const room = await prisma.studyRoom.findUnique({ where: { id } });
    if (!room) throw NotFound('Study room not found');
    return room;
  }

  async join(userId: string, roomId: string) {
    const room = await this.getById(roomId);
    if (!room.isActive) throw Forbidden('Room is closed.');

    await prisma.studyRoomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: { leftAt: null, joinedAt: new Date() },
      create: { roomId, userId },
    });

    eventBus.emit('study-room.joined', { roomId, actorId: userId });
    wsManager.publish(roomChannel(roomId), {
      type: 'PRESENCE_JOINED',
      data: { userId, count: wsManager.presence(roomChannel(roomId)) },
    });
    return room;
  }

  async leave(userId: string, roomId: string) {
    await prisma.studyRoomMember.updateMany({
      where: { roomId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });
    wsManager.publish(roomChannel(roomId), {
      type: 'PRESENCE_LEFT',
      data: { userId, count: wsManager.presence(roomChannel(roomId)) },
    });
    return this.getById(roomId);
  }

  async listMembers(roomId: string) {
    return prisma.studyRoomMember.findMany({
      where: { roomId, leftAt: null },
      include: { user: { include: { college: true } } },
    });
  }

  async listMessages(roomId: string, limit = 100) {
    return prisma.studyRoomMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async postMessage(userId: string, roomId: string, rawBody: unknown) {
    const parsed = ChatMessageSchema.safeParse({ body: rawBody });
    if (!parsed.success) throw Validation('Invalid message', parsed.error.flatten());

    const member = await prisma.studyRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member || member.leftAt) throw Forbidden('Join the room before sending messages.');

    const message = await prisma.studyRoomMessage.create({
      data: { roomId, authorId: userId, body: parsed.data.body },
    });
    wsManager.publish(roomChannel(roomId), { type: 'CHAT_MESSAGE', data: { message } });
    return message;
  }

  /* ------------------------------------------------------- pomodoro */
  async startPomodoro(
    userId: string,
    roomId: string,
    phase: PomodoroState['phase'],
    durationSeconds: number,
  ) {
    const room = await this.getById(roomId);
    if (room.creatorId !== userId) throw Forbidden('Only the room creator can control pomodoro.');

    const next: PomodoroState = {
      phase,
      startedAt: new Date().toISOString(),
      durationSeconds,
      cycle: ((room.pomodoroState as PomodoroState | null)?.cycle ?? 0) + 1,
    };
    await prisma.studyRoom.update({
      where: { id: roomId },
      data: { pomodoroState: next as unknown as Prisma.InputJsonValue },
    });
    wsManager.publish(roomChannel(roomId), { type: 'POMODORO_TICK', data: next });
    return next;
  }

  async stopPomodoro(userId: string, roomId: string) {
    const room = await this.getById(roomId);
    if (room.creatorId !== userId) throw Forbidden('Only the room creator can control pomodoro.');
    const next: PomodoroState = { ...DEFAULT_POMODORO };
    await prisma.studyRoom.update({
      where: { id: roomId },
      data: { pomodoroState: next as unknown as Prisma.InputJsonValue },
    });
    wsManager.publish(roomChannel(roomId), { type: 'POMODORO_TICK', data: next });
    return next;
  }
}

export const studyRoomService = new StudyRoomService();
