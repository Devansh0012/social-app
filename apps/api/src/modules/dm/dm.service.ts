import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { Forbidden, NotFound, parseOrThrow } from '../../core/errors.js';
import { eventBus } from '../../core/events/event-bus.js';
import { userChannel, wsManager } from '../../core/ws/ws-manager.js';
import {
  buildConnection,
  decodeCursor,
  PaginationInput,
} from '../../core/pagination.js';

const SendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export class DMService {
  /**
   * Find an existing 1:1 conversation between viewer and target, or create one.
   * Idempotent — calling this twice returns the same conversation row.
   */
  async openConversation(viewerId: string, targetUsername: string) {
    const target = await prisma.user.findUnique({
      where: { username: targetUsername.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw NotFound('User not found');
    if (target.id === viewerId) throw Forbidden('You cannot DM yourself.');

    // Look for an existing 1:1 conversation with exactly these two participants.
    const existing = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: { userId: { in: [viewerId, target.id] } },
        },
        // Both participants must still be active (leftAt null) and there must be exactly 2.
        AND: [
          { participants: { some: { userId: viewerId, leftAt: null } } },
          { participants: { some: { userId: target.id, leftAt: null } } },
        ],
      },
      include: { participants: true },
    });
    if (existing && existing.participants.length === 2) return existing;

    return prisma.conversation.create({
      data: {
        participants: {
          createMany: {
            data: [{ userId: viewerId }, { userId: target.id }],
          },
        },
      },
      include: { participants: true },
    });
  }

  async listConversations(viewerId: string) {
    const rows = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: viewerId, leftAt: null } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: {
        participants: {
          include: { user: { include: { college: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { author: { include: { college: true } } },
        },
      },
    });

    // Annotate each conversation with unread count + the "other" participant.
    return Promise.all(
      rows.map(async (c) => {
        const me = c.participants.find((p) => p.userId === viewerId);
        const others = c.participants.filter((p) => p.userId !== viewerId);
        const unreadCount = await prisma.directMessage.count({
          where: {
            conversationId: c.id,
            authorId: { not: viewerId },
            ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
          },
        });
        return {
          id: c.id,
          createdAt: c.createdAt,
          lastMessageAt: c.lastMessageAt,
          otherParticipants: others.map((p) => p.user),
          lastMessage: c.messages[0] ?? null,
          unreadCount,
        };
      }),
    );
  }

  async getConversation(viewerId: string, conversationId: string) {
    const c = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { include: { user: { include: { college: true } } } },
      },
    });
    if (!c) throw NotFound('Conversation not found');
    const me = c.participants.find((p) => p.userId === viewerId);
    if (!me || me.leftAt) throw Forbidden();
    return c;
  }

  async listMessages(
    viewerId: string,
    conversationId: string,
    args: { first?: number; after?: string | null },
  ) {
    await this.getConversation(viewerId, conversationId); // permission check
    const pag = PaginationInput.parse({
      first: args.first ?? 50,
      after: args.after ?? null,
    });
    const cursor = decodeCursor(pag.after);

    const where: Prisma.DirectMessageWhereInput = {
      conversationId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.at) } },
              { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    const rows = await prisma.directMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pag.first + 1,
      include: { author: { include: { college: true } } },
    });
    return buildConnection(rows, pag.first, (m) => ({
      at: m.createdAt.toISOString(),
      id: m.id,
    }));
  }

  async sendMessage(viewerId: string, conversationId: string, body: unknown) {
    const input = parseOrThrow(SendMessageSchema, { body }, 'Invalid message');

    const convo = await this.getConversation(viewerId, conversationId);

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.directMessage.create({
        data: {
          conversationId,
          authorId: viewerId,
          body: input.body,
        },
        include: { author: { include: { college: true } } },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: msg.createdAt },
      });
      // Mark sender's own messages as read.
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: viewerId } },
        data: { lastReadAt: msg.createdAt },
      });
      return msg;
    });

    const recipientIds = convo.participants
      .filter((p) => p.userId !== viewerId && !p.leftAt)
      .map((p) => p.userId);

    // Push WS to every active participant so threads update in realtime.
    for (const uid of [viewerId, ...recipientIds]) {
      wsManager.publish(userChannel(uid), {
        type: 'DM_NEW',
        data: { conversationId, message },
      });
    }

    eventBus.emit('dm.sent', {
      conversationId,
      messageId: message.id,
      authorId: viewerId,
      recipientIds,
    });
    return message;
  }

  async markRead(viewerId: string, conversationId: string) {
    await this.getConversation(viewerId, conversationId);
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: viewerId } },
      data: { lastReadAt: new Date() },
    });
    return true;
  }

  async unreadCount(viewerId: string) {
    const parts = await prisma.conversationParticipant.findMany({
      where: { userId: viewerId, leftAt: null },
      select: { conversationId: true, lastReadAt: true },
    });
    if (!parts.length) return 0;
    const counts = await Promise.all(
      parts.map((p) =>
        prisma.directMessage.count({
          where: {
            conversationId: p.conversationId,
            authorId: { not: viewerId },
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        }),
      ),
    );
    return counts.reduce((a, b) => a + b, 0);
  }
}

export const dmService = new DMService();
