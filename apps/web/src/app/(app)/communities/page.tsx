'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import { COMMUNITIES_QUERY, type PageInfo } from '@/lib/queries';

interface CommunitiesResp {
  communities: {
    nodes: Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      iconUrl: string | null;
      tags: string[];
      memberCount: number;
      postCount: number;
      privacy: string;
      viewerMembership: { role: string; joinedAt: string } | null;
    }>;
    pageInfo: PageInfo;
  };
}

export default function CommunitiesPage() {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['communities', search],
    queryFn: () => gql<CommunitiesResp>(COMMUNITIES_QUERY, { search: search || null }),
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Communities</h1>
        <Link href="/communities/new">
          <Button>Create community</Button>
        </Link>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, tag, or description…"
          className="pl-9"
        />
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-10 text-[var(--color-fg-muted)]">Loading…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {query.data?.communities.nodes.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`}>
              <Card className="h-full transition hover:border-[var(--color-border-strong)]">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand-hi)]">
                    {c.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.iconUrl} alt={c.name} className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <Users className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{c.name}</h3>
                      {c.viewerMembership ? <Badge tone="success">Joined</Badge> : null}
                    </div>
                    {c.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--color-fg-muted)]">
                        {c.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                      <span>{c.memberCount} members</span>
                      <span>·</span>
                      <span>{c.postCount} posts</span>
                      {c.tags.slice(0, 3).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
