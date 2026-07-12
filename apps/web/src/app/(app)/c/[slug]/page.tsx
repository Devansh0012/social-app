'use client';

import { use } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toastError } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { PostCard, type PostConnection } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { gql } from '@/lib/graphql-client';
import {
  COMMUNITY_QUERY,
  FEED_QUERY,
  JOIN_COMMUNITY_MUTATION,
  LEAVE_COMMUNITY_MUTATION,
} from '@/lib/queries';

interface CommunityResp {
  community: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    bannerUrl: string | null;
    iconUrl: string | null;
    tags: string[];
    memberCount: number;
    postCount: number;
    privacy: string;
    viewerMembership: { role: string; joinedAt: string } | null;
    creator: { username: string; fullName: string } | null;
  } | null;
}

interface FeedResp {
  feed: PostConnection;
}

export default function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const qc = useQueryClient();

  const community = useQuery({
    queryKey: ['community', slug],
    queryFn: () => gql<CommunityResp>(COMMUNITY_QUERY, { slug }),
  });

  const feed = useInfiniteQuery({
    queryKey: ['feed', 'COMMUNITY', community.data?.community?.id],
    enabled: Boolean(community.data?.community?.id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      gql<FeedResp>(FEED_QUERY, {
        kind: 'COMMUNITY',
        communityId: community.data?.community?.id,
        after: pageParam ?? null,
      }),
    getNextPageParam: (last) =>
      last.feed.pageInfo.hasNextPage ? last.feed.pageInfo.endCursor : null,
  });

  if (community.isLoading) {
    return <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>;
  }
  const c = community.data?.community;
  if (!c) return <div className="py-10 text-center">Community not found.</div>;

  async function toggleMembership() {
    if (!c) return;
    const isMember = Boolean(c.viewerMembership);
    try {
      await gql(isMember ? LEAVE_COMMUNITY_MUTATION : JOIN_COMMUNITY_MUTATION, {
        communityId: c.id,
      });
      qc.invalidateQueries({ queryKey: ['community', slug] });
    } catch (err) {
      toastError(err, isMember ? 'Could not leave community' : 'Could not join community');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="bx-card overflow-hidden p-0">
        <div className="h-32 bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-lo)]" />
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="-mt-12 grid h-16 w-16 place-items-center rounded-xl border-4 border-[var(--color-bg)] bg-[var(--color-bg-elevated)] text-[var(--color-brand-hi)]">
              <Users className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">{c.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                <span>{c.memberCount} members</span>
                <span>·</span>
                <span>{c.postCount} posts</span>
                <Badge>{c.privacy}</Badge>
              </div>
            </div>
            <Button
              onClick={toggleMembership}
              variant={c.viewerMembership ? 'outline' : 'primary'}
            >
              {c.viewerMembership ? 'Leave' : 'Join'}
            </Button>
          </div>
          {c.description ? (
            <p className="text-sm text-[var(--color-fg-muted)]">{c.description}</p>
          ) : null}
          {c.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {c.viewerMembership ? (
        <PostComposer
          communityId={c.id}
          onPosted={() => qc.invalidateQueries({ queryKey: ['feed', 'COMMUNITY', c.id] })}
        />
      ) : (
        <Card className="text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">Join this community to post here.</p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {(feed.data?.pages.flatMap((p) => p.feed.nodes) ?? []).map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
      {feed.hasNextPage ? (
        <Button variant="outline" onClick={() => feed.fetchNextPage()}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
