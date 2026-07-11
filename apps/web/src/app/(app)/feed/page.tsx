'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { gql } from '@/lib/graphql-client';
import { FEED_QUERY } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { PostCard, type PostConnection } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { cn } from '@/lib/utils';

type FeedKind = 'PERSONALIZED' | 'GLOBAL' | 'TRENDING';

interface FeedResp {
  feed: PostConnection;
}

const TABS: { key: FeedKind; label: string }[] = [
  { key: 'PERSONALIZED', label: 'For you' },
  { key: 'GLOBAL', label: 'Global' },
  { key: 'TRENDING', label: 'Trending' },
];

export default function FeedPage() {
  const [kind, setKind] = useState<FeedKind>('PERSONALIZED');
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['feed', kind],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      gql<FeedResp>(FEED_QUERY, { kind, after: pageParam ?? null }),
    getNextPageParam: (last) => (last.feed.pageInfo.hasNextPage ? last.feed.pageInfo.endCursor : null),
  });

  const posts = query.data?.pages.flatMap((p) => p.feed.nodes) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PostComposer onPosted={() => qc.invalidateQueries({ queryKey: ['feed'] })} />

      <div className="sticky top-14 z-20 -mx-4 flex gap-1 border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_92%,transparent)] px-4 backdrop-blur md:mx-0 md:rounded-lg md:border md:px-2 md:py-1">
        {TABS.map((t) => {
          const active = t.key === kind;
          return (
            <button
              key={t.key}
              onClick={() => setKind(t.key)}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-fg)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {query.isLoading ? (
        <SkeletonCard />
      ) : posts.length === 0 ? (
        <div className="bx-card grid place-items-center p-10 text-center text-[var(--color-fg-muted)]">
          <p>Nothing here yet. Follow some communities or be the first to post.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {query.hasNextPage ? (
        <div className="grid place-items-center pt-4">
          <Button
            variant="outline"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bx-card animate-pulse p-5">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-[var(--color-bg-elevated)]" />
        <div className="flex-1">
          <div className="h-3 w-1/3 rounded bg-[var(--color-bg-elevated)]" />
          <div className="mt-2 h-3 w-1/2 rounded bg-[var(--color-bg-elevated)]" />
        </div>
      </div>
      <div className="mt-4 h-20 rounded bg-[var(--color-bg-elevated)]" />
    </div>
  );
}
