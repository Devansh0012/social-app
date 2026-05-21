'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn, pluralize, relativeTime } from '@/lib/utils';
import { gql } from '@/lib/graphql-client';
import {
  BOOKMARK_POST_MUTATION,
  DELETE_POST_MUTATION,
  LIKE_POST_MUTATION,
  SHARE_POST_MUTATION,
  UNBOOKMARK_POST_MUTATION,
  UNLIKE_POST_MUTATION,
  UPDATE_POST_MUTATION,
} from '@/lib/queries';
import { useAuthStore } from '@/lib/auth-store';

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
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [shared, setShared] = useState(false);
  const qc = useQueryClient();
  const viewer = useAuthStore((s) => s.viewer);
  const isOwner = viewer?.id === post.author.id;

  // Resync when the parent passes a refreshed version (e.g. feed re-fetch).
  useEffect(() => {
    setPost(initial);
  }, [
    initial.id,
    initial.likeCount,
    initial.bookmarkCount,
    initial.viewerHasLiked,
    initial.viewerHasBookmarked,
    initial.commentCount,
    initial.body,
    initial.title,
  ]);

  async function onDelete() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await gql(DELETE_POST_MUTATION, { postId: post.id });
      setDeleted(true);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['post', post.id] });
    } catch (err) {
      window.alert((err as Error).message ?? 'Could not delete');
    }
  }

  async function onShare() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/p/${post.id}`;
    const title = post.title ?? `${post.author.fullName} on Braventex`;

    // Deliberately *don't* pass `text` — many share targets concatenate
    // text + url into a single line, which results in pastes that glue
    // body content onto the URL and produce broken /p/<id><body> links.
    let didShare = false;
    try {
      const nav = typeof navigator !== 'undefined' ? navigator : null;
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title, url });
        didShare = true;
      } else if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        didShare = true;
      }
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === 'AbortError') return;
      // Otherwise fall through.
    }

    if (!didShare) return;

    // Optimistic local + cache update; backend records analytics + bumps counter.
    const patch = { shareCount: post.shareCount + 1 };
    setPost((p) => ({ ...p, ...patch }));
    applyToCaches(patch);
    setShared(true);
    setTimeout(() => setShared(false), 1500);
    try {
      await gql(SHARE_POST_MUTATION, { postId: post.id });
    } catch {
      // Non-critical — the user did share. Just leave the count be.
    }
  }

  if (deleted) {
    return (
      <div className="bx-card p-4 text-sm text-[var(--color-fg-muted)]">Post deleted.</div>
    );
  }

  function applyToCaches(patch: Partial<PostNode>) {
    // Patch every cached query that holds this post so navigating away and
    // back (within the React Query stale window) doesn't show old counts.
    qc.setQueriesData<unknown>({ predicate: () => true }, (old: unknown) =>
      patchPostInCache(old, post.id, patch),
    );
  }

  async function onLike() {
    const liked = post.viewerHasLiked;
    const patch = {
      viewerHasLiked: !liked,
      likeCount: post.likeCount + (liked ? -1 : 1),
    };
    setPost((p) => ({ ...p, ...patch }));
    applyToCaches(patch);
    try {
      await gql(liked ? UNLIKE_POST_MUTATION : LIKE_POST_MUTATION, { postId: post.id });
    } catch {
      const revert = {
        viewerHasLiked: liked,
        likeCount: post.likeCount,
      };
      setPost((p) => ({ ...p, ...revert }));
      applyToCaches(revert);
    }
  }
  async function onBookmark() {
    const saved = post.viewerHasBookmarked;
    const patch = {
      viewerHasBookmarked: !saved,
      bookmarkCount: post.bookmarkCount + (saved ? -1 : 1),
    };
    setPost((p) => ({ ...p, ...patch }));
    applyToCaches(patch);
    try {
      await gql(saved ? UNBOOKMARK_POST_MUTATION : BOOKMARK_POST_MUTATION, { postId: post.id });
    } catch {
      const revert = {
        viewerHasBookmarked: saved,
        bookmarkCount: post.bookmarkCount,
      };
      setPost((p) => ({ ...p, ...revert }));
      applyToCaches(revert);
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
        {isOwner ? (
          <OwnerMenu
            onEdit={() => setEditing(true)}
            onDelete={onDelete}
            disabled={editing}
          />
        ) : null}
      </div>

      <div className="px-5 py-4">
        {editing ? (
          <EditForm
            post={post}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setPost((p) => ({ ...p, ...updated }));
              setEditing(false);
              qc.invalidateQueries({ queryKey: ['feed'] });
              qc.invalidateQueries({ queryKey: ['post', post.id] });
            }}
          />
        ) : (
          <>
            {post.title ? <h3 className="mb-2 text-lg font-semibold">{post.title}</h3> : null}
            {post.collab ? <CollabSummary collab={post.collab} /> : null}
            {post.body ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-fg)]/95">
                {post.body}
              </p>
            ) : null}
          </>
        )}
        {!editing && post.type === 'LINK' && post.linkUrl ? (
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
        {!editing && post.type === 'IMAGE' && post.imageUrls.length ? (
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
        {!editing && post.tags.length ? (
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
        <button
          onClick={onShare}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-elevated)]',
            shared && 'text-[var(--color-accent)]',
          )}
          aria-label={shared ? 'Link copied' : 'Share post'}
        >
          {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {shared ? 'Copied' : 'Share'}
        </button>
      </div>
    </article>
  );
}

/**
 * Recursive cache patcher. React Query cache holds arbitrarily-shaped
 * payloads (feed pages, post detail, infinite-query arrays). Walk every
 * object we can reach and apply `patch` to anything that looks like a Post
 * with the right id. Idempotent + safe on unrelated shapes.
 */
function patchPostInCache(node: unknown, postId: string, patch: Partial<PostNode>): unknown {
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item) => {
      const updated = patchPostInCache(item, postId, patch);
      if (updated !== item) changed = true;
      return updated;
    });
    return changed ? next : node;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    // Is this object itself the post?
    if (typeof obj.id === 'string' && obj.id === postId && 'viewerHasLiked' in obj) {
      return { ...obj, ...patch };
    }
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const updated = patchPostInCache(val, postId, patch);
      if (updated !== val) changed = true;
      next[key] = updated;
    }
    return changed ? next : node;
  }
  return node;
}

function OwnerMenu({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Post actions"
        className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-elevated)]"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-bg-elevated)]"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EditForm({
  post,
  onSaved,
  onCancel,
}: {
  post: PostNode;
  onSaved: (patch: Partial<PostNode>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post.title ?? '');
  const [body, setBody] = useState(post.body ?? '');
  const [linkUrl, setLinkUrl] = useState(post.linkUrl ?? '');
  const [tags, setTags] = useState(post.tags.join(', '));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const data = await gql<{ updatePost: PostNode }>(UPDATE_POST_MUTATION, {
        postId: post.id,
        input: {
          title: title || null,
          body: body || null,
          linkUrl: post.type === 'LINK' ? (linkUrl || null) : undefined,
          tags: tags
            ? tags
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
            : [],
        },
      });
      onSaved(data.updatePost);
    } catch (e) {
      setErr((e as Error).message ?? 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {(post.type === 'TEXT' || post.type === 'MARKDOWN' || post.type === 'LINK') &&
      (post.title || post.type === 'LINK') ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
        />
      ) : null}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Body"
        className="min-h-24"
      />
      {post.type === 'LINK' ? (
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://…"
          className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
        />
      ) : null}
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tags (comma-separated)"
        className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
      />
      {err ? <p className="text-xs text-[var(--color-danger)]">{err}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
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
