'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PostCard, type PostNode } from '@/components/post-card';
import { gql } from '@/lib/graphql-client';
import { PUBLIC_USER_FRAGMENT } from '@/lib/queries';

const SEARCH_QUERY = /* GraphQL */ `
  query GlobalSearch($query: String!) {
    search(query: $query) {
      users {
        ...PublicUserFields
      }
      communities {
        id
        slug
        name
        memberCount
        tags
      }
      posts {
        id
        type
        title
        body
        linkUrl
        imageUrls
        tags
        likeCount
        commentCount
        bookmarkCount
        shareCount
        viewCount
        hotScore
        publishedAt
        viewerHasLiked
        viewerHasBookmarked
        author { ...PublicUserFields }
        community { id slug name iconUrl }
        collab {
          projectTitle
          requiredSkills
          projectType
          duration
          teamSize
          locationType
          openSlots
          isClosed
        }
      }
      materials {
        id
        title
        description
        downloadCount
        subject
        tags
      }
    }
  }
  ${PUBLIC_USER_FRAGMENT}
`;

interface SearchResp {
  search: {
    users: Array<{ id: string; username: string; fullName: string; avatarUrl: string | null; college: { name: string } | null }>;
    communities: Array<{ id: string; slug: string; name: string; memberCount: number; tags: string[] }>;
    posts: PostNode[];
    materials: Array<{ id: string; title: string; description: string | null; downloadCount: number; subject: string | null; tags: string[] }>;
  };
}

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const q = useQuery({
    queryKey: ['search', query],
    enabled: query.trim().length > 1,
    queryFn: () => gql<SearchResp>(SEARCH_QUERY, { query }),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Discover</h1>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
        <Input
          autoFocus
          placeholder="Search people, communities, posts, materials…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {q.data ? (
        <div className="flex flex-col gap-6">
          <Section title="People">
            {q.data.search.users.length === 0 ? null : (
              <div className="grid gap-2 md:grid-cols-2">
                {q.data.search.users.map((u) => (
                  <Link key={u.id} href={`/u/${u.username}`}>
                    <Card className="flex items-center gap-3">
                      <Avatar src={u.avatarUrl} name={u.fullName} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{u.fullName}</div>
                        <div className="truncate text-xs text-[var(--color-fg-muted)]">
                          @{u.username} · {u.college?.name}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="Communities">
            <div className="grid gap-2 md:grid-cols-2">
              {q.data.search.communities.map((c) => (
                <Link key={c.id} href={`/c/${c.slug}`}>
                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-[var(--color-fg-muted)]">
                          {c.memberCount} members
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 2).map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Posts">
            <div className="flex flex-col gap-3">
              {q.data.search.posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </Section>

          <Section title="Study materials">
            <div className="grid gap-2 md:grid-cols-2">
              {q.data.search.materials.map((m) => (
                <Card key={m.id}>
                  <div className="font-medium">{m.title}</div>
                  {m.description ? (
                    <p className="line-clamp-2 text-sm text-[var(--color-fg-muted)]">
                      {m.description}
                    </p>
                  ) : null}
                  <div className="mt-2 text-xs text-[var(--color-fg-muted)]">
                    {m.subject ?? 'General'} · {m.downloadCount} downloads
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        </div>
      ) : query.length > 1 ? (
        <div className="py-10 text-center text-[var(--color-fg-muted)]">Searching…</div>
      ) : (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Type two characters or more to search.
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
