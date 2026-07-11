'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { gql } from '@/lib/graphql-client';
import {
  ADMIN_COLLEGES_QUERY,
  ADMIN_CREATE_COLLEGE_MUTATION,
  ADMIN_DELETE_COLLEGE_MUTATION,
  ADMIN_UPDATE_COLLEGE_MUTATION,
  type AdminCollege,
} from '@/lib/queries';
import { relativeTime } from '@/lib/utils';

interface CollegesResp {
  adminColleges: AdminCollege[];
}

export default function AdminCollegesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const query = useQuery({
    queryKey: ['admin', 'colleges', search],
    queryFn: () => gql<CollegesResp>(ADMIN_COLLEGES_QUERY, { search: search || null }),
  });

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This fails if any user still belongs to it.`)) return;
    try {
      await gql(ADMIN_DELETE_COLLEGE_MUTATION, { id });
      qc.invalidateQueries({ queryKey: ['admin', 'colleges'] });
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {query.data?.adminColleges.length ?? 0} college
          {query.data?.adminColleges.length === 1 ? '' : 's'}
        </p>
        <Button onClick={() => setShowCreate((v) => !v)} size="sm">
          <Plus className="h-4 w-4" />
          {showCreate ? 'Cancel' : 'Add college'}
        </Button>
      </header>

      {showCreate ? (
        <CollegeForm
          onSaved={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['admin', 'colleges'] });
          }}
        />
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or domain…"
          className="pl-9"
        />
      </div>

      {query.isLoading ? (
        <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>
      ) : (query.data?.adminColleges ?? []).length === 0 ? (
        <Card className="text-center text-[var(--color-fg-muted)]">No colleges match.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {query.data?.adminColleges.map((c) =>
            editingId === c.id ? (
              <CollegeForm
                key={c.id}
                initial={c}
                onSaved={() => {
                  setEditingId(null);
                  qc.invalidateQueries({ queryKey: ['admin', 'colleges'] });
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={c.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.country ? <Badge>{c.country}</Badge> : null}
                    <Badge tone={c.userCount > 0 ? 'success' : 'neutral'}>
                      {c.userCount} user{c.userCount === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <div className="text-xs text-[var(--color-fg-muted)]">
                    {c.domain} · added {relativeTime(c.createdAt)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditingId(c.id)}>
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(c.id, c.name)}>
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function CollegeForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AdminCollege;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [domain, setDomain] = useState(initial?.domain ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const payload = { name, domain: domain.toLowerCase(), country: country || undefined };
      if (initial) {
        await gql(ADMIN_UPDATE_COLLEGE_MUTATION, { id: initial.id, input: payload });
      } else {
        await gql(ADMIN_CREATE_COLLEGE_MUTATION, { input: payload });
      }
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
        <label className="text-sm text-[var(--color-fg-muted)] md:col-span-2">
          Name
          <Input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Country (e.g. US, IN)
          <Input
            value={country}
            maxLength={4}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)] md:col-span-2">
          Email domain (lowercase, no @)
          <Input
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="university.edu"
            className="mt-1"
          />
        </label>
        {err ? <p className="text-sm text-[var(--color-danger)] md:col-span-3">{err}</p> : null}
        <div className="flex items-center gap-2 md:col-span-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add college'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
