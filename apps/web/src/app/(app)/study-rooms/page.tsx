'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Timer } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { gql } from '@/lib/graphql-client';
import { CREATE_STUDY_ROOM_MUTATION, STUDY_ROOMS_QUERY } from '@/lib/queries';

interface RoomsResp {
  studyRooms: Array<{
    id: string;
    name: string;
    description: string | null;
    topic: string | null;
    maxParticipants: number;
    isActive: boolean;
    createdAt: string;
    activePresence: number;
    pomodoro: { phase: string; durationSeconds: number; cycle: number };
    creator: { username: string; fullName: string; avatarUrl: string | null };
  }>;
}

export default function StudyRoomsPage() {
  const qc = useQueryClient();
  const rooms = useQuery({ queryKey: ['studyRooms'], queryFn: () => gql<RoomsResp>(STUDY_ROOMS_QUERY) });
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await gql(CREATE_STUDY_ROOM_MUTATION, {
        input: { name, topic: topic || undefined, maxParticipants: 20 },
      });
      setName('');
      setTopic('');
      qc.invalidateQueries({ queryKey: ['studyRooms'] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Study Rooms</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Drop into a room, share a chat, run a pomodoro together.
        </p>
      </header>

      <Card>
        <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row">
          <Input
            required
            placeholder="Room name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Topic (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            <Plus className="h-4 w-4" />
            {busy ? 'Creating…' : 'Create room'}
          </Button>
        </form>
      </Card>

      {rooms.isLoading ? (
        <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>
      ) : (rooms.data?.studyRooms ?? []).length === 0 ? (
        <Card className="text-center text-[var(--color-fg-muted)]">
          No active rooms. Be the first to start one.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rooms.data?.studyRooms.map((r) => (
            <Link key={r.id} href={`/study-rooms/${r.id}`}>
              <Card className="h-full transition hover:border-[var(--color-border-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.topic ? (
                      <p className="text-xs text-[var(--color-fg-muted)]">{r.topic}</p>
                    ) : null}
                  </div>
                  <Badge tone={r.pomodoro.phase === 'FOCUS' ? 'brand' : 'neutral'}>
                    <Timer className="h-3 w-3" />
                    {r.pomodoro.phase}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                  <Avatar
                    src={r.creator.avatarUrl}
                    name={r.creator.fullName}
                    size={20}
                  />
                  <span>{r.creator.fullName}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {r.activePresence}/{r.maxParticipants}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
