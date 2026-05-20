'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, Search, Plus, Ban, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { gql } from '@/lib/graphql-client';
import {
  ADMIN_BAN_USER_MUTATION,
  ADMIN_COLLEGES_QUERY,
  ADMIN_CREATE_USER_MUTATION,
  ADMIN_SET_USER_ROLE_MUTATION,
  ADMIN_UNBAN_USER_MUTATION,
  ADMIN_USERS_QUERY,
  ADMIN_VERIFY_USER_MUTATION,
} from '@/lib/queries';
import { cn, relativeTime } from '@/lib/utils';

type Status = 'PENDING_VERIFICATION' | 'ACTIVE' | 'BANNED';
type Role = 'USER' | 'ADMIN';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  college: { id: string; name: string; domain: string };
  role: Role;
  status: Status;
  emailVerified: boolean;
  isVerifiedStudent: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

interface UsersResp {
  adminUsers: {
    nodes: AdminUser[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    totalCount: number;
  };
}

interface CollegesResp {
  adminColleges: Array<{ id: string; name: string; domain: string; userCount: number }>;
}

const STATUS_FILTERS: Array<{ key: Status | null; label: string }> = [
  { key: null, label: 'All' },
  { key: 'PENDING_VERIFICATION', label: 'Pending' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'BANNED', label: 'Banned' },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const usersQuery = useInfiniteQuery({
    queryKey: ['admin', 'users', status, search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      gql<UsersResp>(ADMIN_USERS_QUERY, {
        status,
        search: search || null,
        after: pageParam ?? null,
      }),
    getNextPageParam: (last) => (last.adminUsers.pageInfo.hasNextPage ? last.adminUsers.pageInfo.endCursor : null),
  });

  const total = usersQuery.data?.pages[0]?.adminUsers.totalCount ?? 0;
  const rows = usersQuery.data?.pages.flatMap((p) => p.adminUsers.nodes) ?? [];

  async function verifyUser(userId: string) {
    await gql(ADMIN_VERIFY_USER_MUTATION, { userId });
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  }
  async function ban(userId: string) {
    const reason = window.prompt('Reason for ban?') ?? '';
    if (!reason) return;
    await gql(ADMIN_BAN_USER_MUTATION, { userId, reason });
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  }
  async function unban(userId: string) {
    await gql(ADMIN_UNBAN_USER_MUTATION, { userId });
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  }
  async function toggleRole(u: AdminUser) {
    const next: Role = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!window.confirm(`Set ${u.username}'s role to ${next}?`)) return;
    await gql(ADMIN_SET_USER_ROLE_MUTATION, { userId: u.id, role: next });
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {total.toLocaleString()} user{total === 1 ? '' : 's'}
        </p>
        <Button onClick={() => setShowCreate((v) => !v)} size="sm">
          <Plus className="h-4 w-4" />
          {showCreate ? 'Cancel' : 'Create user'}
        </Button>
      </header>

      {showCreate ? (
        <CreateUserForm
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['admin', 'users'] });
          }}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={String(f.key)}
            onClick={() => setStatus(f.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition',
              status === f.key
                ? 'bg-[var(--color-bg-card)] text-[var(--color-fg)]'
                : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-card)]',
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, username, or name…"
            className="pl-9"
          />
        </div>
      </div>

      {usersQuery.isLoading ? (
        <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <Card className="text-center text-[var(--color-fg-muted)]">No users match.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((u) => (
            <Card key={u.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
              <Avatar src={u.avatarUrl} name={u.fullName} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/u/${u.username}`} className="font-medium hover:underline">
                    {u.fullName}
                  </Link>
                  <span className="text-xs text-[var(--color-fg-muted)]">@{u.username}</span>
                  {u.role === 'ADMIN' ? (
                    <Badge tone="brand">
                      <ShieldCheck className="h-3 w-3" />
                      Admin
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--color-fg-muted)]">
                  {u.email} · {u.college.name} · joined {relativeTime(u.createdAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill status={u.status} verified={u.emailVerified} />
                {!u.emailVerified ? (
                  <Button size="sm" variant="outline" onClick={() => verifyUser(u.id)}>
                    <CheckCircle2 className="h-3 w-3" />
                    Verify
                  </Button>
                ) : null}
                {u.status === 'BANNED' ? (
                  <Button size="sm" variant="outline" onClick={() => unban(u.id)}>
                    <UserCheck className="h-3 w-3" />
                    Unban
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => ban(u.id)}>
                    <Ban className="h-3 w-3" />
                    Ban
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => toggleRole(u)}>
                  {u.role === 'ADMIN' ? 'Demote' : 'Promote'}
                </Button>
              </div>
            </Card>
          ))}
          {usersQuery.hasNextPage ? (
            <div className="grid place-items-center pt-2">
              <Button
                variant="outline"
                onClick={() => usersQuery.fetchNextPage()}
                disabled={usersQuery.isFetchingNextPage}
              >
                {usersQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, verified }: { status: Status; verified: boolean }) {
  if (status === 'BANNED') return <Badge tone="danger">Banned</Badge>;
  if (status === 'ACTIVE') return <Badge tone="success">{verified ? 'Verified' : 'Active'}</Badge>;
  return <Badge tone="warn">Pending</Badge>;
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    username: '',
    collegeId: '',
    role: 'USER' as Role,
    emailVerified: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const colleges = useQuery({
    queryKey: ['admin', 'colleges', ''],
    queryFn: () => gql<CollegesResp>(ADMIN_COLLEGES_QUERY, { search: null }),
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await gql(ADMIN_CREATE_USER_MUTATION, {
        input: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          username: form.username || undefined,
          collegeId: form.collegeId,
          role: form.role,
          emailVerified: form.emailVerified,
        },
      });
      onCreated();
    } catch (e2) {
      setErr((e2 as Error).message ?? 'Could not create user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-[var(--color-fg-muted)]">
          Email
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Full name
          <Input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Username (optional)
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Password
          <Input
            type="text"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          College
          <select
            required
            value={form.collegeId}
            onChange={(e) => setForm({ ...form, collegeId: e.target.value })}
            className="mt-1 h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
          >
            <option value="">— Pick a college —</option>
            {colleges.data?.adminColleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.domain})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Role
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="mt-1 h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.emailVerified}
            onChange={(e) => setForm({ ...form, emailVerified: e.target.checked })}
          />
          Mark email verified
        </label>
        {err ? <p className="text-sm text-[var(--color-danger)] md:col-span-2">{err}</p> : null}
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
