'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { gql } from '@/lib/graphql-client';
import { CONVERSATIONS_QUERY, type DMAuthor } from '@/lib/queries';
import { useAuthStore } from '@/lib/auth-store';
import { relativeTime } from '@/lib/utils';

interface ConversationsResp {
  conversations: Array<{
    id: string;
    lastMessageAt: string;
    unreadCount: number;
    otherParticipants: DMAuthor[];
    lastMessage: {
      id: string;
      body: string;
      createdAt: string;
      author: { id: string; username: string; fullName: string };
    } | null;
  }>;
  unreadDMCount: number;
}

export default function MessagesPage() {
  const viewer = useAuthStore((s) => s.viewer);

  const q = useQuery({
    queryKey: ['conversations'],
    queryFn: () => gql<ConversationsResp>(CONVERSATIONS_QUERY),
  });

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="font-display text-2xl font-bold">Messages</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          DM other students directly. Threads update live.
        </p>
      </header>

      {q.isLoading ? (
        <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>
      ) : !q.data?.conversations.length ? (
        <Card className="grid place-items-center gap-2 py-10 text-center">
          <Inbox className="h-6 w-6 text-[var(--color-fg-muted)]" />
          <p className="text-[var(--color-fg-muted)]">
            No conversations yet. Open someone's profile and tap{' '}
            <span className="text-[var(--color-fg)]">Message</span>.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {q.data.conversations.map((c) => {
            const other = c.otherParticipants[0];
            if (!other) return null;
            const last = c.lastMessage;
            const lastFromMe = last?.author.id === viewer?.id;
            return (
              <Link key={c.id} href={`/messages/${c.id}`}>
                <Card className="flex items-center gap-3 p-3 transition hover:border-[var(--color-border-strong)]">
                  <Avatar src={other.avatarUrl} name={other.fullName} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{other.fullName}</span>
                        <span className="text-xs text-[var(--color-fg-muted)]">
                          @{other.username}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-fg-muted)]">
                        {relativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    {last ? (
                      <p className="mt-0.5 truncate text-sm text-[var(--color-fg-muted)]">
                        {lastFromMe ? 'You: ' : ''}
                        {last.body}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm italic text-[var(--color-fg-subtle)]">
                        Say hi 👋
                      </p>
                    )}
                  </div>
                  {c.unreadCount > 0 ? <Badge tone="brand">{c.unreadCount}</Badge> : null}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
