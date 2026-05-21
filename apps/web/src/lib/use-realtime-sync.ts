'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './auth-store';
import { env } from './env';

interface NotificationPayload {
  type:
    | 'POST_LIKE'
    | 'POST_COMMENT'
    | 'COMMENT_REPLY'
    | 'COLLAB_REQUEST'
    | 'COLLAB_RESPONSE'
    | 'COMMUNITY_INVITE'
    | 'MENTION'
    | 'SYSTEM'
    | 'NEW_FOLLOWER'
    | 'NEW_DM';
  payload?: Record<string, unknown>;
  actor?: { id: string; username: string } | null;
}

/**
 * Single global WebSocket subscription for the signed-in user. Pages don't
 * need their own WS — they just listen to React Query cache changes.
 *
 * Reconnects with exponential backoff. Drops cache entries based on the
 * type of event received, which causes any mounted query to refetch.
 */
export function useRealtimeSync() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const viewer = useAuthStore((s) => s.viewer);
  const qc = useQueryClient();

  useEffect(() => {
    if (!accessToken || !viewer) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(`${env.wsUrl}/notifications?token=${accessToken}`);

      ws.onopen = () => {
        retryDelay = 1000; // reset backoff on a successful connect
      };

      ws.onmessage = (evt) => {
        try {
          const envelope = JSON.parse(evt.data as string) as {
            type: string;
            data: unknown;
          };
          handleEvent(envelope, qc, viewer.username);
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [accessToken, viewer, qc]);
}

function handleEvent(
  envelope: { type: string; data: unknown },
  qc: ReturnType<typeof useQueryClient>,
  viewerUsername: string,
) {
  switch (envelope.type) {
    case 'NOTIFICATION_NEW': {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      const n = envelope.data as NotificationPayload;
      const payload = (n.payload ?? {}) as { postId?: string; conversationId?: string };
      switch (n.type) {
        case 'POST_LIKE':
        case 'POST_COMMENT':
        case 'COMMENT_REPLY':
          if (payload.postId) {
            qc.invalidateQueries({ queryKey: ['post', payload.postId] });
          }
          qc.invalidateQueries({ queryKey: ['feed'] });
          break;
        case 'NEW_FOLLOWER':
          // The followed user (this viewer) — refresh their profile counts.
          qc.invalidateQueries({ queryKey: ['user', viewerUsername] });
          break;
        case 'COLLAB_REQUEST':
        case 'COLLAB_RESPONSE':
          qc.invalidateQueries({ queryKey: ['feed'] });
          break;
        case 'NEW_DM':
          qc.invalidateQueries({ queryKey: ['conversations'] });
          if (payload.conversationId) {
            qc.invalidateQueries({ queryKey: ['messages', payload.conversationId] });
          }
          break;
      }
      break;
    }
    case 'DM_NEW': {
      const d = envelope.data as { conversationId?: string };
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (d.conversationId) {
        qc.invalidateQueries({ queryKey: ['messages', d.conversationId] });
      }
      break;
    }
    case 'POST_UPDATED': {
      const d = envelope.data as { postId?: string };
      if (d.postId) qc.invalidateQueries({ queryKey: ['post', d.postId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      break;
    }
  }
}
