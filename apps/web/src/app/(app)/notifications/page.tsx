'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, UserPlus, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import {
  MARK_ALL_NOTIFICATIONS_READ_MUTATION,
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATIONS_QUERY,
  type PublicUser,
} from '@/lib/queries';
import { cn, relativeTime } from '@/lib/utils';

interface NotificationsResp {
  notifications: Array<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
    actor: PublicUser | null;
  }>;
  unreadNotificationCount: number;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => gql<NotificationsResp>(NOTIFICATIONS_QUERY, { unreadOnly: false }),
  });

  async function markRead(id: string) {
    await gql(MARK_NOTIFICATION_READ_MUTATION, { id });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function markAllRead() {
    await gql(MARK_ALL_NOTIFICATIONS_READ_MUTATION);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  function open(n: NotificationsResp['notifications'][number]) {
    if (!n.readAt) void markRead(n.id);
    const href = targetHref(n);
    if (href) router.push(href);
  }

  const hasUnread = (query.data?.unreadNotificationCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-1">
          {hasUnread ? (
            <Button variant="ghost" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['notifications'] })}>
            Refresh
          </Button>
        </div>
      </header>
      {query.isLoading ? (
        <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>
      ) : query.data?.notifications.length === 0 ? (
        <Card className="text-center text-[var(--color-fg-muted)]">No notifications yet.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {query.data?.notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={cn(
                'bx-card flex w-full items-center gap-3 p-4 text-left transition hover:border-[var(--color-border-strong)]',
                !n.readAt && 'border-[var(--color-brand)]/40 bg-[var(--color-brand)]/5',
              )}
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)]">
                <NotificationIcon type={n.type} />
              </div>
              {n.actor ? (
                <Link
                  href={`/u/${n.actor.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                >
                  <Avatar src={n.actor.avatarUrl} name={n.actor.fullName} size={32} />
                </Link>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {summarise(n)}
                </p>
                <p className="text-xs text-[var(--color-fg-muted)]">{relativeTime(n.createdAt)}</p>
              </div>
              {!n.readAt ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Where clicking a notification should take the user, based on its payload. */
function targetHref(n: NotificationsResp['notifications'][number]): string | null {
  const { postId, conversationId } = n.payload as {
    postId?: string;
    conversationId?: string;
  };
  if (n.type === 'NEW_DM' && conversationId) return `/messages/${conversationId}`;
  if (n.type === 'NEW_FOLLOWER' && n.actor) return `/u/${n.actor.username}`;
  if (postId) return `/p/${postId}`;
  return null;
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'POST_LIKE':
      return <Heart className="h-4 w-4 text-[var(--color-danger)]" />;
    case 'POST_COMMENT':
    case 'COMMENT_REPLY':
      return <MessageCircle className="h-4 w-4 text-[var(--color-brand-hi)]" />;
    case 'COLLAB_REQUEST':
    case 'COLLAB_RESPONSE':
    case 'NEW_FOLLOWER':
      return <UserPlus className="h-4 w-4 text-[var(--color-accent)]" />;
    case 'NEW_DM':
      return <MessageCircle className="h-4 w-4 text-[var(--color-brand-hi)]" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function summarise(n: NotificationsResp['notifications'][number]): string {
  const actor = n.actor?.fullName ?? 'Someone';
  switch (n.type) {
    case 'POST_LIKE':
      return `${actor} liked your post`;
    case 'POST_COMMENT':
      return `${actor} commented on your post`;
    case 'COMMENT_REPLY':
      return `${actor} replied to your comment`;
    case 'COLLAB_REQUEST':
      return `${actor} applied to your collab`;
    case 'COLLAB_RESPONSE':
      return `${actor} responded to your application`;
    case 'COMMUNITY_INVITE':
      return `${actor} invited you to a community`;
    case 'MENTION':
      return `${actor} mentioned you`;
    case 'NEW_FOLLOWER':
      return `${actor} started following you`;
    case 'NEW_DM':
      return `${actor} sent you a message`;
    default:
      return 'New activity';
  }
}
