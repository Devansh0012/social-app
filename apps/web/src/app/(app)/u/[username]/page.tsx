'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { gql } from '@/lib/graphql-client';
import { USER_PROFILE_QUERY } from '@/lib/queries';

interface ProfileResp {
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    bio: string | null;
    department: string | null;
    graduationYear: number | null;
    interests: string[];
    skills: string[];
    isVerifiedStudent: boolean;
    reputationScore: number;
    college: { id: string; name: string } | null;
    createdAt: string;
  } | null;
}

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const q = useQuery({
    queryKey: ['user', username],
    queryFn: () => gql<ProfileResp>(USER_PROFILE_QUERY, { username }),
  });

  if (q.isLoading) return <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>;
  const u = q.data?.user;
  if (!u) return <div className="py-10 text-center">User not found.</div>;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0 overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-lo)]" />
        <div className="flex flex-col gap-3 p-5">
          <div className="-mt-14 flex items-center gap-3">
            <Avatar src={u.avatarUrl} name={u.fullName} size={80} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold">{u.fullName}</h1>
                {u.isVerifiedStudent ? (
                  <Sparkles className="h-4 w-4 text-[var(--color-brand-hi)]" />
                ) : null}
              </div>
              <div className="text-sm text-[var(--color-fg-muted)]">@{u.username}</div>
              <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
                {u.college?.name}
                {u.department ? ` · ${u.department}` : ''}
                {u.graduationYear ? ` · '${String(u.graduationYear).slice(-2)}` : ''}
              </div>
            </div>
          </div>
          {u.bio ? <p className="text-sm">{u.bio}</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Reputation" value={u.reputationScore.toLocaleString()} />
            <Stat label="Skills" value={u.skills.length.toString()} />
            <Stat label="Interests" value={u.interests.length.toString()} />
            <Stat label="Member since" value={new Date(u.createdAt).toLocaleDateString()} />
          </div>
          {u.interests.length ? (
            <div>
              <div className="text-xs text-[var(--color-fg-muted)]">Interests</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {u.interests.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            </div>
          ) : null}
          {u.skills.length ? (
            <div>
              <div className="text-xs text-[var(--color-fg-muted)]">Skills</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {u.skills.map((t) => (
                  <Badge key={t} tone="brand">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2">
      <div className="text-xs text-[var(--color-fg-muted)]">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
