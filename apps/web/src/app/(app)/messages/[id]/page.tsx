'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import {
  CONVERSATION_QUERY,
  MARK_CONVERSATION_READ_MUTATION,
  MESSAGES_QUERY,
  SEND_DM_MUTATION,
  type DMAuthor,
  type PageInfo,
} from '@/lib/queries';
import { useAuthStore } from '@/lib/auth-store';
import { env } from '@/lib/env';
import { cn, relativeTime } from '@/lib/utils';

interface Message {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  author: DMAuthor;
}

interface MessagesResp {
  messages: {
    nodes: Message[];
    pageInfo: PageInfo;
  };
}

interface ConvoResp {
  conversation: {
    id: string;
    otherParticipants: DMAuthor[];
  };
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const viewer = useAuthStore((s) => s.viewer);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const convo = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => gql<ConvoResp>(CONVERSATION_QUERY, { id }),
  });

  const msgQuery = useQuery({
    queryKey: ['messages', id],
    queryFn: () => gql<MessagesResp>(MESSAGES_QUERY, { conversationId: id, after: null }),
  });

  // Hydrate local messages state from the fetched page.
  useEffect(() => {
    if (msgQuery.data) setMessages(msgQuery.data.messages.nodes);
  }, [msgQuery.data]);

  // WS subscription for live message arrival.
  useEffect(() => {
    if (!accessToken) return;
    const ws = new WebSocket(`${env.wsUrl}/notifications?token=${accessToken}`);
    ws.onmessage = (evt) => {
      try {
        const envelope = JSON.parse(evt.data as string) as {
          type: string;
          data: { conversationId: string; message: Message };
        };
        if (envelope.type === 'DM_NEW' && envelope.data.conversationId === id) {
          setMessages((prev) =>
            prev.some((m) => m.id === envelope.data.message.id) ? prev : [...prev, envelope.data.message],
          );
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, [accessToken, id]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mark conversation read when we open/refocus it.
  useEffect(() => {
    if (!convo.data) return;
    void gql(MARK_CONVERSATION_READ_MUTATION, { conversationId: id }).then(() =>
      qc.invalidateQueries({ queryKey: ['conversations'] }),
    );
  }, [convo.data, id, qc]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setBody('');
    setSending(true);
    try {
      const data = await gql<{ sendMessage: Message }>(SEND_DM_MUTATION, {
        conversationId: id,
        body: text,
      });
      // Append optimistically — but WS may also deliver it; the id check dedupes.
      setMessages((prev) =>
        prev.some((m) => m.id === data.sendMessage.id) ? prev : [...prev, data.sendMessage],
      );
    } catch {
      // Send failed — restore the draft so the user can retry.
      setBody(text);
    } finally {
      setSending(false);
    }
  }

  const other = convo.data?.conversation.otherParticipants[0];

  return (
    <div className="flex h-[calc(100dvh-200px)] flex-col gap-3 md:h-[calc(100dvh-160px)]">
      <header className="flex items-center gap-3">
        <Link
          href="/messages"
          className="flex items-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {other ? (
          <Link href={`/u/${other.username}`} className="flex items-center gap-2 hover:underline">
            <Avatar src={other.avatarUrl} name={other.fullName} size={32} />
            <div>
              <div className="font-medium leading-tight">{other.fullName}</div>
              <div className="text-xs text-[var(--color-fg-muted)]">@{other.username}</div>
            </div>
          </Link>
        ) : null}
      </header>

      <Card className="flex flex-1 flex-col p-0">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-fg-muted)]">
              Send the first message.
            </p>
          ) : (
            messages.map((m, i) => {
              const mine = m.author.id === viewer?.id;
              const prev = messages[i - 1];
              const sameAuthor = prev && prev.author.id === m.author.id;
              return (
                <div key={m.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
                  {!sameAuthor ? (
                    <Avatar src={m.author.avatarUrl} name={m.author.fullName} size={28} />
                  ) : (
                    <div className="w-7 shrink-0" />
                  )}
                  <div className={cn('max-w-[75%]', mine ? 'items-end' : 'items-start')}>
                    {!sameAuthor ? (
                      <div
                        className={cn(
                          'mb-1 text-xs text-[var(--color-fg-muted)]',
                          mine && 'text-right',
                        )}
                      >
                        {mine ? 'You' : m.author.fullName} · {relativeTime(m.createdAt)}
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        'whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                        mine
                          ? 'bg-[var(--color-brand)] text-white'
                          : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2 border-t border-[var(--color-border)] p-3"
        >
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={sending || !body.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
