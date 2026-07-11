import { EventEmitter } from 'node:events';

/**
 * Strongly-typed in-process event bus. MVP runs everything in one node;
 * future scale-out swaps this for Redis Pub/Sub or NATS — listener
 * call-sites stay identical.
 */

export interface AppEvents {
  'post.created': { postId: string; authorId: string; communityId: string | null };
  'post.liked': { postId: string; postAuthorId: string; actorId: string };
  'post.unliked': { postId: string; actorId: string };
  'post.bookmarked': { postId: string; actorId: string };
  'post.shared': { postId: string; actorId: string };
  'post.viewed': { postId: string; actorId: string | null };
  'comment.created': {
    commentId: string;
    postId: string;
    postAuthorId: string;
    parentAuthorId: string | null;
    actorId: string;
  };
  'community.joined': { communityId: string; actorId: string };
  'community.left': { communityId: string; actorId: string };
  'collab.applied': {
    postId: string;
    collabOwnerId: string;
    applicantId: string;
    applicationId: string;
  };
  'collab.responded': {
    applicationId: string;
    applicantId: string;
    decidedById: string;
    decision: 'ACCEPTED' | 'REJECTED';
  };
  'study-material.downloaded': { materialId: string; actorId: string };
  'study-material.viewed': { materialId: string; actorId: string | null };
  'study-room.joined': { roomId: string; actorId: string };
  'search.performed': { actorId: string | null; query: string };
  'user.followed': { followerId: string; followedId: string };
  'user.unfollowed': { followerId: string; followedId: string };
  'dm.sent': {
    conversationId: string;
    messageId: string;
    authorId: string;
    recipientIds: string[];
  };
}

class TypedEventBus {
  private emitter = new EventEmitter({ captureRejections: true });

  constructor() {
    // `captureRejections` funnels async listener failures into the 'error'
    // event. Without this handler an unhandled 'error' emit throws — and,
    // because emits run inside setImmediate, that would become an uncaught
    // exception and crash the process. Listeners are fire-and-forget side
    // effects (notifications, analytics), so log and keep serving requests.
    this.emitter.on('error', (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[event-bus] listener failed', err);
    });
  }

  on<E extends keyof AppEvents>(event: E, listener: (payload: AppEvents[E]) => void | Promise<void>) {
    this.emitter.on(event, listener);
  }

  emit<E extends keyof AppEvents>(event: E, payload: AppEvents[E]): void {
    // setImmediate keeps event handlers off the request hot path.
    setImmediate(() => this.emitter.emit(event, payload));
  }
}

export const eventBus = new TypedEventBus();
