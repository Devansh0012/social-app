'use client';

import { use, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { PostCard, type PostNode } from '@/components/post-card';
import { gql } from '@/lib/graphql-client';
import { ADD_COMMENT_MUTATION, POST_DETAIL_QUERY } from '@/lib/queries';
import { useAuthStore } from '@/lib/auth-store';
import { relativeTime } from '@/lib/utils';

interface CommentRow {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    isVerifiedStudent: boolean;
  };
}

interface DetailResp {
  post: PostNode | null;
  postComments: CommentRow[];
}

interface CommentTreeNode extends CommentRow {
  children: CommentTreeNode[];
}

function buildTree(rows: CommentRow[]): CommentTreeNode[] {
  const byId = new Map<string, CommentTreeNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: CommentTreeNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const viewer = useAuthStore((s) => s.viewer);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['post', id],
    queryFn: () => gql<DetailResp>(POST_DETAIL_QUERY, { id }),
  });

  const tree = useMemo(() => buildTree(query.data?.postComments ?? []), [query.data?.postComments]);

  if (query.isLoading) {
    return <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>;
  }
  if (!query.data?.post) {
    return <div className="py-10 text-center">Post not found.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/feed" className="inline-flex w-fit items-center gap-1 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      <PostCard post={query.data.post} />

      <section className="bx-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          <MessageCircle className="h-4 w-4" />
          {query.data.postComments.length} comment{query.data.postComments.length === 1 ? '' : 's'}
        </h2>

        {viewer ? (
          <CommentComposer
            postId={id}
            parentId={null}
            onPosted={() => qc.invalidateQueries({ queryKey: ['post', id] })}
          />
        ) : (
          <Card className="mb-4 text-center text-sm text-[var(--color-fg-muted)]">
            Log in to comment.
          </Card>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {tree.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">Be the first to comment.</p>
          ) : (
            tree.map((c) => <CommentNode key={c.id} node={c} postId={id} depth={0} />)
          )}
        </div>
      </section>
    </div>
  );
}

function CommentNode({ node, postId, depth }: { node: CommentTreeNode; postId: string; depth: number }) {
  const viewer = useAuthStore((s) => s.viewer);
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);

  return (
    <div className={depth > 0 ? 'pl-4 border-l border-[var(--color-border)]' : ''}>
      <div className="flex gap-3">
        <Link href={`/u/${node.author.username}`} className="shrink-0">
          <Avatar src={node.author.avatarUrl} name={node.author.fullName} size={32} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[var(--color-fg-muted)]">
            <Link href={`/u/${node.author.username}`} className="font-medium text-[var(--color-fg)] hover:underline">
              {node.author.fullName}
            </Link>{' '}
            · @{node.author.username} · {relativeTime(node.createdAt)}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{node.body}</p>
          {viewer ? (
            <button
              onClick={() => setReplying((v) => !v)}
              className="mt-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              {replying ? 'Cancel' : 'Reply'}
            </button>
          ) : null}
          {replying ? (
            <div className="mt-2">
              <CommentComposer
                postId={postId}
                parentId={node.id}
                onPosted={() => {
                  setReplying(false);
                  qc.invalidateQueries({ queryKey: ['post', postId] });
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
      {node.children.length ? (
        <div className="mt-3 flex flex-col gap-3 pl-11">
          {node.children.map((child) => (
            <CommentNode key={child.id} node={child} postId={postId} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentComposer({
  postId,
  parentId,
  onPosted,
}: {
  postId: string;
  parentId: string | null;
  onPosted: () => void;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await gql(ADD_COMMENT_MUTATION, {
        input: { postId, parentId: parentId ?? undefined, body },
      });
      setBody('');
      onPosted();
    } catch (e) {
      setErr((e as Error).message ?? 'Could not post comment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? 'Write a reply…' : 'Write a comment…'}
        className="min-h-20"
      />
      {err ? <p className="mt-1 text-xs text-[var(--color-danger)]">{err}</p> : null}
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? 'Posting…' : parentId ? 'Reply' : 'Comment'}
        </Button>
      </div>
    </div>
  );
}
