'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Hash,
  Sparkles,
  ExternalLink,
  Users as UsersIcon,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn, pluralize, relativeTime } from '@/lib/utils';
import { gql } from '@/lib/graphql-client';
import {
  BOOKMARK_POST_MUTATION,
  LIKE_POST_MUTATION,
  UNBOOKMARK_POST_MUTATION,
  UNLIKE_POST_MUTATION,
} from '@/lib/queries';

export interface PostNode {
  id: string;
  type: 'TEXT' | 'IMAGE' | 'MARKDOWN' | 'LINK' | 'COLLAB';
  title?: string | null;
  body?: string | null;
  linkUrl?: string | null;
  imageUrls: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  shareCount: number;
  publishedAt: string;
  viewerHasLiked: boolean;
  viewerHasBookmarked: boolean;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    isVerifiedStudent: boolean;
    college: { name: string } | null;
  };
  community?: { id: string; slug: string; name: string; iconUrl: string | null } | null;
  collab?: {
    projectTitle: string;
    requiredSkills: string[];
    projectType: string;
    duration: string;
    teamSize: number;
    locationType: string;
    openSlots: number;
    isClosed: boolean;
  } | null;
}

export function PostCard({ post: initial }: { post: PostNode }) {
  const [post, setPost] = useState(initial);

  async function onLike() {
    const liked = post.viewerHasLiked;
    setPost((p) => ({
      ...p,
      viewerHasLiked: !liked,
      likeCount: p.likeCount + (liked ? -1 : 1),
    }));
    try {
      await gql(liked ? UNLIKE_POST_MUTATION : LIKE_POST_MUTATION, { postId: post.id });
    } catch {
      setPost((p) => ({ ...p, viewerHasLiked: liked, likeCount: p.likeCount + (liked ? 1 : -1) }));
    }
  }
  async function onBookmark() {
    const saved = post.viewerHasBookmarked;
    setPost((p) => ({
      ...p,
      viewerHasBookmarked: !saved,
      bookmarkCount: p.bookmarkCount + (saved ? -1 : 1),
    }));
    try {
      await gql(saved ? UNBOOKMARK_POST_MUTATION : BOOKMARK_POST_MUTATION, { postId: post.id });
    } catch {
      setPost((p) => ({
        ...p,
        viewerHasBookmarked: saved,
        bookmarkCount: p.bookmarkCount + (saved ? 1 : -1),
      }));
    }
  }

  return (
    <article className="bx-card overflow-hidden transition hover:border-[var(--color-border-strong)]">
      <div className="flex items-center gap-3 px-5 pt-5">
        <Link href={`/u/${post.author.username}`}>
          <Avatar src={post.author.avatarUrl} name={post.author.fullName} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <Link href={`/u/${post.author.username}`} className="font-semibold hover:underline">
              {post.author.fullName}
            </Link>
            {post.author.isVerifiedStudent ? (
              <Sparkles className="h-3 w-3 text-[var(--color-brand-hi)]" />
            ) : null}
            <span className="text-[var(--color-fg-muted)]">·</span>
            <Link
              href={`/u/${post.author.username}`}
              className="text-[var(--color-fg-muted)] hover:underline"
            >
              @{post.author.username}
            </Link>
            <span className="text-[var(--color-fg-muted)]">·</span>
            <span className="text-[var(--color-fg-muted)]">{relativeTime(post.publishedAt)}</span>
          </div>
          {post.community ? (
            <Link
              href={`/c/${post.community.slug}`}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              in {post.community.name}
            </Link>
          ) : (
            <div className="text-xs text-[var(--color-fg-subtle)]">{post.author.college?.name}</div>
          )}
        </div>
        {post.type === 'COLLAB' ? <Badge tone="brand">Collab</Badge> : null}
      </div>

      <div className="px-5 py-4">
        {post.title ? <h3 className="mb-2 text-lg font-semibold">{post.title}</h3> : null}
        {post.collab ? <CollabSummary collab={post.collab} /> : null}
        {post.body ? (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-fg)]/95">
            {post.body}
          </p>
        ) : null}
        {post.type === 'LINK' && post.linkUrl ? (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="truncate">{post.linkUrl}</span>
          </a>
        ) : null}
        {post.type === 'IMAGE' && post.imageUrls.length ? (
          <div
            className={cn(
              'mt-3 grid gap-2 overflow-hidden rounded-lg',
              post.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
            )}
          >
            {post.imageUrls.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt="post image"
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}
        {post.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)]"
              >
                <Hash className="h-3 w-3" />
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2 text-sm">
        <button
          onClick={onLike}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-elevated)]',
            post.viewerHasLiked && 'text-[var(--color-danger)]',
          )}
        >
          <Heart
            className={cn('h-4 w-4', post.viewerHasLiked && 'fill-current')}
          />
          {pluralize(post.likeCount, 'like')}
        </button>
        <Link
          href={`/p/${post.id}`}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-elevated)]"
        >
          <MessageCircle className="h-4 w-4" />
          {pluralize(post.commentCount, 'reply', 'replies')}
        </Link>
        <button
          onClick={onBookmark}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-elevated)]',
            post.viewerHasBookmarked && 'text-[var(--color-brand-hi)]',
          )}
        >
          <Bookmark
            className={cn('h-4 w-4', post.viewerHasBookmarked && 'fill-current')}
          />
          Save
        </button>
        <button className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-elevated)]">
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </article>
  );
}

function CollabSummary({ collab }: { collab: NonNullable<PostNode['collab']> }) {
  return (
    <div className="mb-3 rounded-lg border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-[var(--color-brand-hi)]">{collab.projectTitle}</h4>
        <Badge tone="brand">{collab.projectType}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-fg-muted)]">
        <span className="flex items-center gap-1">
          <UsersIcon className="h-3 w-3" />
          team of {collab.teamSize}
        </span>
        <span>{collab.duration.toLowerCase()}</span>
        <span>{collab.locationType.toLowerCase().replace('_', '-')}</span>
        <span>{collab.openSlots} slots open</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {collab.requiredSkills.map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
    </div>
  );
}
