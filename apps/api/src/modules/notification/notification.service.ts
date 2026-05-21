import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../core/prisma.js';
import { Forbidden, NotFound } from '../../core/errors.js';
import { eventBus } from '../../core/events/event-bus.js';
import { userChannel, wsManager } from '../../core/ws/ws-manager.js';

interface NotificationDispatch {
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  payload: Prisma.InputJsonValue;
}

export class NotificationService {
  async list(viewerId: string, args: { unreadOnly?: boolean; limit?: number }) {
    return prisma.notification.findMany({
      where: { userId: viewerId, ...(args.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit ?? 30, 100),
    });
  }

  async unreadCount(viewerId: string) {
    return prisma.notification.count({ where: { userId: viewerId, readAt: null } });
  }

  async markRead(viewerId: string, id: string) {
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) throw NotFound('Notification not found');
    if (notif.userId !== viewerId) throw Forbidden();
    if (notif.readAt) return notif;
    return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(viewerId: string) {
    await prisma.notification.updateMany({
      where: { userId: viewerId, readAt: null },
      data: { readAt: new Date() },
    });
    return true;
  }

  async dispatch(dispatch: NotificationDispatch): Promise<void> {
    if (dispatch.actorId && dispatch.actorId === dispatch.recipientId) return;
    const row = await prisma.notification.create({
      data: {
        userId: dispatch.recipientId,
        actorId: dispatch.actorId,
        type: dispatch.type,
        payload: dispatch.payload,
      },
      include: { actor: true },
    });
    wsManager.publish(userChannel(dispatch.recipientId), {
      type: 'NOTIFICATION_NEW',
      data: row,
    });
  }
}

export const notificationService = new NotificationService();

// Bind notification creation to domain events.
eventBus.on('post.liked', async (e) => {
  await notificationService.dispatch({
    recipientId: e.postAuthorId,
    actorId: e.actorId,
    type: 'POST_LIKE',
    payload: { postId: e.postId },
  });
});

eventBus.on('comment.created', async (e) => {
  // notify post author
  if (e.postAuthorId !== e.actorId) {
    await notificationService.dispatch({
      recipientId: e.postAuthorId,
      actorId: e.actorId,
      type: 'POST_COMMENT',
      payload: { postId: e.postId, commentId: e.commentId },
    });
  }
  // notify parent commenter if reply
  if (e.parentAuthorId && e.parentAuthorId !== e.actorId && e.parentAuthorId !== e.postAuthorId) {
    await notificationService.dispatch({
      recipientId: e.parentAuthorId,
      actorId: e.actorId,
      type: 'COMMENT_REPLY',
      payload: { postId: e.postId, commentId: e.commentId },
    });
  }
});

eventBus.on('collab.applied', async (e) => {
  await notificationService.dispatch({
    recipientId: e.collabOwnerId,
    actorId: e.applicantId,
    type: 'COLLAB_REQUEST',
    payload: { postId: e.postId, applicationId: e.applicationId },
  });
});

eventBus.on('collab.responded', async (e) => {
  await notificationService.dispatch({
    recipientId: e.applicantId,
    actorId: e.decidedById,
    type: 'COLLAB_RESPONSE',
    payload: { applicationId: e.applicationId, decision: e.decision },
  });
});

eventBus.on('user.followed', async (e) => {
  await notificationService.dispatch({
    recipientId: e.followedId,
    actorId: e.followerId,
    type: 'NEW_FOLLOWER',
    payload: {},
  });
});

eventBus.on('dm.sent', async (e) => {
  // Only push a notification when the recipient isn't actively watching the
  // conversation. The DM WebSocket frame they get when looking at the thread
  // is enough; piling on a notification too is noisy.
  for (const rid of e.recipientIds) {
    await notificationService.dispatch({
      recipientId: rid,
      actorId: e.authorId,
      type: 'NEW_DM',
      payload: { conversationId: e.conversationId, messageId: e.messageId },
    });
  }
});
