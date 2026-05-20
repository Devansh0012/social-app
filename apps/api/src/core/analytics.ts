import { Prisma, type AnalyticsEventType } from '@prisma/client';
import { prisma } from './prisma.js';
import { eventBus } from './events/event-bus.js';

interface RecordOptions {
  userId: string | null;
  type: AnalyticsEventType;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  sessionId?: string;
}

/**
 * Persist an analytics event. Fire-and-forget: failures are logged but do not
 * block the request. Recommendation systems will read directly from this
 * table — keep it append-only.
 */
export function recordEvent(opts: RecordOptions): void {
  setImmediate(() => {
    prisma.analyticsEvent
      .create({
        data: {
          userId: opts.userId,
          type: opts.type,
          targetType: opts.targetType ?? null,
          targetId: opts.targetId ?? null,
          metadata: opts.metadata ?? Prisma.JsonNull,
          sessionId: opts.sessionId ?? null,
        },
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[analytics] failed to record event', err);
      });
  });
}

// Bind event-bus → analytics. Each domain event maps to 0..n analytics rows.
eventBus.on('post.viewed', (e) =>
  recordEvent({ userId: e.actorId, type: 'POST_VIEW', targetType: 'post', targetId: e.postId }),
);
eventBus.on('post.liked', (e) =>
  recordEvent({ userId: e.actorId, type: 'POST_LIKE', targetType: 'post', targetId: e.postId }),
);
eventBus.on('post.unliked', (e) =>
  recordEvent({ userId: e.actorId, type: 'POST_UNLIKE', targetType: 'post', targetId: e.postId }),
);
eventBus.on('post.bookmarked', (e) =>
  recordEvent({ userId: e.actorId, type: 'POST_BOOKMARK', targetType: 'post', targetId: e.postId }),
);
eventBus.on('post.shared', (e) =>
  recordEvent({ userId: e.actorId, type: 'POST_SHARE', targetType: 'post', targetId: e.postId }),
);
eventBus.on('comment.created', (e) =>
  recordEvent({ userId: e.actorId, type: 'POST_COMMENT', targetType: 'post', targetId: e.postId }),
);
eventBus.on('community.joined', (e) =>
  recordEvent({
    userId: e.actorId,
    type: 'COMMUNITY_JOIN',
    targetType: 'community',
    targetId: e.communityId,
  }),
);
eventBus.on('community.left', (e) =>
  recordEvent({
    userId: e.actorId,
    type: 'COMMUNITY_LEAVE',
    targetType: 'community',
    targetId: e.communityId,
  }),
);
eventBus.on('study-material.downloaded', (e) =>
  recordEvent({
    userId: e.actorId,
    type: 'STUDY_MATERIAL_DOWNLOAD',
    targetType: 'studyMaterial',
    targetId: e.materialId,
  }),
);
eventBus.on('study-material.viewed', (e) =>
  recordEvent({
    userId: e.actorId,
    type: 'STUDY_MATERIAL_VIEW',
    targetType: 'studyMaterial',
    targetId: e.materialId,
  }),
);
eventBus.on('study-room.joined', (e) =>
  recordEvent({
    userId: e.actorId,
    type: 'STUDY_ROOM_JOIN',
    targetType: 'studyRoom',
    targetId: e.roomId,
  }),
);
eventBus.on('search.performed', (e) =>
  recordEvent({
    userId: e.actorId,
    type: 'SEARCH',
    metadata: { query: e.query },
  }),
);
