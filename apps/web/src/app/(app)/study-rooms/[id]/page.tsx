'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Users, Play, Pause } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { gql } from '@/lib/graphql-client';
import { useAuthStore } from '@/lib/auth-store';
import { env } from '@/lib/env';
import { relativeTime } from '@/lib/utils';

interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; fullName: string; avatarUrl: string | null };
}
interface RoomResp {
  studyRoom: {
    id: string;
    name: string;
    topic: string | null;
    description: string | null;
    activePresence: number;
    maxParticipants: number;
    creator: { id: string; username: string; fullName: string; avatarUrl: string | null };
    pomodoro: {
      phase: 'IDLE' | 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
      startedAt: string | null;
      durationSeconds: number;
      cycle: number;
    };
  };
  studyRoomMessages: ChatMessage[];
}

const ROOM_QUERY = /* GraphQL */ `
  query Room($id: ID!) {
    studyRoom(id: $id) {
      id
      name
      topic
      description
      activePresence
      maxParticipants
      creator { id username fullName avatarUrl }
      pomodoro { phase startedAt durationSeconds cycle }
    }
    studyRoomMessages(roomId: $id) {
      id
      body
      createdAt
      author { id username fullName avatarUrl }
    }
  }
`;

const JOIN_MUTATION = /* GraphQL */ `
  mutation JoinRoom($roomId: ID!) {
    joinStudyRoom(roomId: $roomId) { id }
  }
`;
const SEND_MUTATION = /* GraphQL */ `
  mutation SendMessage($roomId: ID!, $body: String!) {
    sendStudyRoomMessage(roomId: $roomId, body: $body) { id }
  }
`;
const START_POMODORO_MUTATION = /* GraphQL */ `
  mutation StartPomodoro($roomId: ID!, $phase: PomodoroPhase!, $durationSeconds: Int!) {
    startPomodoro(roomId: $roomId, phase: $phase, durationSeconds: $durationSeconds) {
      phase
      durationSeconds
      startedAt
      cycle
    }
  }
`;
const STOP_POMODORO_MUTATION = /* GraphQL */ `
  mutation StopPomodoro($roomId: ID!) {
    stopPomodoro(roomId: $roomId) { phase durationSeconds startedAt cycle }
  }
`;

export default function StudyRoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const viewer = useAuthStore((s) => s.viewer);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pomodoro, setPomodoro] = useState<RoomResp['studyRoom']['pomodoro']>({
    phase: 'IDLE',
    durationSeconds: 25 * 60,
    startedAt: null,
    cycle: 0,
  });
  const [presence, setPresence] = useState(0);
  const [body, setBody] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const q = useQuery({
    queryKey: ['studyRoom', id],
    queryFn: () => gql<RoomResp>(ROOM_QUERY, { id }),
  });

  useEffect(() => {
    if (q.data) {
      setMessages(q.data.studyRoomMessages);
      setPomodoro(q.data.studyRoom.pomodoro);
      setPresence(q.data.studyRoom.activePresence);
    }
  }, [q.data]);

  useEffect(() => {
    if (!accessToken) return;
    void gql(JOIN_MUTATION, { roomId: id });
    const ws = new WebSocket(`${env.wsUrl}/rooms/${id}?token=${accessToken}`);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const envelope = JSON.parse(evt.data as string) as {
          type: string;
          data: unknown;
        };
        if (envelope.type === 'CHAT_MESSAGE') {
          const m = (envelope.data as { message: ChatMessage }).message;
          setMessages((prev) => [...prev, m]);
        } else if (envelope.type === 'POMODORO_TICK') {
          setPomodoro(envelope.data as typeof pomodoro);
        } else if (envelope.type === 'PRESENCE_JOINED' || envelope.type === 'PRESENCE_LEFT') {
          setPresence((envelope.data as { count: number }).count);
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBody('');
    try {
      await gql(SEND_MUTATION, { roomId: id, body: text });
    } catch (err) {
      // restore on failure
      setBody(text);
    }
  }

  const room = q.data?.studyRoom;
  const isCreator = viewer?.id === room?.creator.id;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold">{room?.name ?? 'Room'}</h1>
              {room?.topic ? (
                <p className="text-sm text-[var(--color-fg-muted)]">{room.topic}</p>
              ) : null}
            </div>
            <Badge tone="success">
              <Users className="h-3 w-3" />
              {presence} live
            </Badge>
          </div>
        </Card>

        <Card className="flex h-[60vh] flex-col p-0">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-2">
                <Avatar src={m.author.avatarUrl} name={m.author.fullName} size={28} />
                <div>
                  <div className="text-xs text-[var(--color-fg-muted)]">
                    <span className="font-medium text-[var(--color-fg)]">{m.author.fullName}</span>
                    {' · '}
                    {relativeTime(m.createdAt)}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-[var(--color-border)] p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Say something nice…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <Button type="submit" size="icon" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Pomodoro
          </h2>
          <Timer
            phase={pomodoro.phase}
            startedAt={pomodoro.startedAt}
            durationSeconds={pomodoro.durationSeconds}
          />
          {isCreator ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() =>
                  void gql(START_POMODORO_MUTATION, {
                    roomId: id,
                    phase: 'FOCUS',
                    durationSeconds: 25 * 60,
                  })
                }
              >
                <Play className="h-3 w-3" />
                25-min focus
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void gql(START_POMODORO_MUTATION, {
                    roomId: id,
                    phase: 'SHORT_BREAK',
                    durationSeconds: 5 * 60,
                  })
                }
              >
                5-min break
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void gql(STOP_POMODORO_MUTATION, { roomId: id })}>
                <Pause className="h-3 w-3" />
                Stop
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
              Only the room creator can control the timer.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            About
          </h2>
          {room ? (
            <>
              <p className="text-sm">{room.description ?? 'No description.'}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                <Avatar src={room.creator.avatarUrl} name={room.creator.fullName} size={24} />
                Started by {room.creator.fullName}
              </div>
            </>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}

function Timer({
  phase,
  startedAt,
  durationSeconds,
}: {
  phase: 'IDLE' | 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  startedAt: string | null;
  durationSeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (phase === 'IDLE' || !startedAt) {
    return (
      <div className="font-mono text-3xl font-semibold text-[var(--color-fg-muted)]">
        --:--
      </div>
    );
  }
  const endsAt = new Date(startedAt).getTime() + durationSeconds * 1000;
  const remainingMs = Math.max(0, endsAt - now);
  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1_000);
  const color =
    phase === 'FOCUS' ? 'text-[var(--color-brand-hi)]' : 'text-[var(--color-accent)]';
  return (
    <div>
      <div className={`font-mono text-3xl font-semibold ${color}`}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div className="text-xs text-[var(--color-fg-muted)]">{phase.replace('_', ' ')}</div>
    </div>
  );
}
