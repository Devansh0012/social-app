import type { WebSocket } from '@fastify/websocket';

/**
 * In-memory channel manager. Two channel kinds are used in MVP:
 *   - `user:<userId>`        → per-user push (notifications)
 *   - `room:<studyRoomId>`   → study-room chat + presence + pomodoro
 *
 * For horizontal scale-out the publish() method becomes a Redis Pub/Sub
 * publish; subscribers in each process still receive via this in-memory map.
 */

type Sockets = Set<WebSocket>;

export interface SocketEnvelope<T = unknown> {
  type: string;
  data: T;
  ts: number;
}

class WsManager {
  private channels = new Map<string, Sockets>();

  join(channel: string, socket: WebSocket): void {
    let bucket = this.channels.get(channel);
    if (!bucket) {
      bucket = new Set();
      this.channels.set(channel, bucket);
    }
    bucket.add(socket);
    socket.on('close', () => this.leave(channel, socket));
  }

  leave(channel: string, socket: WebSocket): void {
    const bucket = this.channels.get(channel);
    if (!bucket) return;
    bucket.delete(socket);
    if (bucket.size === 0) this.channels.delete(channel);
  }

  publish<T>(channel: string, envelope: Omit<SocketEnvelope<T>, 'ts'>): number {
    const bucket = this.channels.get(channel);
    if (!bucket) return 0;
    const payload = JSON.stringify({ ...envelope, ts: Date.now() });
    let delivered = 0;
    for (const sock of bucket) {
      try {
        sock.send(payload);
        delivered += 1;
      } catch {
        /* socket closed mid-broadcast — leave() will sweep it */
      }
    }
    return delivered;
  }

  presence(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }

  channelsFor(predicate: (channel: string) => boolean): string[] {
    return [...this.channels.keys()].filter(predicate);
  }
}

export const wsManager = new WsManager();
export const userChannel = (userId: string) => `user:${userId}`;
export const roomChannel = (roomId: string) => `room:${roomId}`;
