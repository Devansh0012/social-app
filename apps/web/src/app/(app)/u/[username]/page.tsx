'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Sparkles, MessageSquare, UserPlus, UserMinus, Trash2, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { PostCard, type PostNode } from '@/components/post-card';
import { gql } from '@/lib/graphql-client';
import {
  DELETE_COMMENT_MUTATION,
  FOLLOW_USER_MUTATION,
  MY_BOOKMARKED_POSTS_QUERY,
  MY_LIKED_POSTS_QUERY,
  OPEN_CONVERSATION_MUTATION,
  UNFOLLOW_USER_MUTATION,
  UPDATE_COMMENT_MUTATION,
  USER_COMMENTS_QUERY,
  USER_POSTS_QUERY,
  USER_PROFILE_QUERY,
} from '@/lib/queries';
import { useAuthStore } from '@/lib/auth-store';
import { cn, relativeTime } from '@/lib/utils';

interface PublicUser {
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
  followerCount: number;
  followingCount: number;
  viewerIsFollowing: boolean;
}

interface ProfileResp {
  user: PublicUser | null;
}

type TabKey = 'posts' | 'comments' | 'likes' | 'bookmarks';

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const viewer = useAuthStore((s) => s.viewer);
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('posts');

  const q = useQuery({
    queryKey: ['user', username],
    queryFn: () => gql<ProfileResp>(USER_PROFILE_QUERY, { username }),
  });

  const [followBusy, setFollowBusy] = useState(false);
  const [msgBusy, setMsgBusy] = useState(false);

  if (q.isLoading)
    return <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>;
  const u = q.data?.user;
  if (!u) return <div className="py-10 text-center">User not found.</div>;

  const isSelf = viewer?.id === u.id;
  const tabs: Array<{ key: TabKey; label: string; visible: boolean }> = [
    { key: 'posts', label: 'Posts', visible: true },
    { key: 'comments', label: 'Comments', visible: true },
    { key: 'likes', label: 'Likes', visible: isSelf },
    { key: 'bookmarks', label: 'Bookmarks', visible: isSelf },
  ];

  async function toggleFollow() {
    if (!u) return;
    setFollowBusy(true);
    const wasFollowing = u.viewerIsFollowing;
    qc.setQueryData<ProfileResp>(['user', username], (old) =>
      old?.user
        ? {
            user: {
              ...old.user,
              viewerIsFollowing: !wasFollowing,
              followerCount: old.user.followerCount + (wasFollowing ? -1 : 1),
            },
          }
        : old,
    );
    try {
      await gql(wasFollowing ? UNFOLLOW_USER_MUTATION : FOLLOW_USER_MUTATION, {
        username: u.username,
      });
    } catch {
      qc.setQueryData<ProfileResp>(['user', username], (old) =>
        old?.user
          ? {
              user: {
                ...old.user,
                viewerIsFollowing: wasFollowing,
                followerCount: old.user.followerCount + (wasFollowing ? 1 : -1),
              },
            }
          : old,
      );
    } finally {
      setFollowBusy(false);
    }
  }

  async function messageUser() {
    if (!u) return;
    setMsgBusy(true);
    try {
      const data = await gql<{ openConversation: { id: string } }>(OPEN_CONVERSATION_MUTATION, {
        username: u.username,
      });
      router.push(`/messages/${data.openConversation.id}`);
    } finally {
      setMsgBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0 overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-lo)]" />
        <div className="flex flex-col gap-3 p-5">
          <div className="-mt-14 flex items-start gap-3">
            <Avatar src={u.avatarUrl} name={u.fullName} size={80} />
            <div className="min-w-0 flex-1">
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
            {viewer && !isSelf ? (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant={u.viewerIsFollowing ? 'outline' : 'primary'}
                  onClick={toggleFollow}
                  disabled={followBusy}
                >
                  {u.viewerIsFollowing ? (
                    <>
                      <UserMinus className="h-3 w-3" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" />
                      Follow
                    </>
                  )}
                </Button>
                <Button size="sm" variant="secondary" onClick={messageUser} disabled={msgBusy}>
                  <MessageSquare className="h-3 w-3" />
                  Message
                </Button>
              </div>
            ) : null}
          </div>
          {u.bio ? <p className="text-sm">{u.bio}</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Followers" value={u.followerCount.toLocaleString()} />
            <Stat label="Following" value={u.followingCount.toLocaleString()} />
            <Stat label="Reputation" value={u.reputationScore.toLocaleString()} />
            <Stat label="Joined" value={new Date(u.createdAt).toLocaleDateString()} />
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

      <nav className="flex gap-1 border-b border-[var(--color-border)]">
        {tabs
          .filter((t) => t.visible)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
                tab === t.key
                  ? 'border-[var(--color-brand)] text-[var(--color-fg)]'
                  : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
              )}
            >
              {t.label}
            </button>
          ))}
      </nav>

      {tab === 'posts' ? <PostsList username={u.username} /> : null}
      {tab === 'comments' ? <CommentsList username={u.username} isSelf={isSelf} /> : null}
      {tab === 'likes' && isSelf ? <MyPostList queryKey="myLikedPosts" /> : null}
      {tab === 'bookmarks' && isSelf ? <MyPostList queryKey="myBookmarkedPosts" /> : null}
    </div>
  );
}

interface PostConn {
  nodes: PostNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

function PostsList({ username }: { username: string }) {
  const query = useInfiniteQuery({
    queryKey: ['userPosts', username],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      gql<{ userPosts: PostConn }>(USER_POSTS_QUERY, {
        username,
        after: pageParam ?? null,
      }),
    getNextPageParam: (last) =>
      last.userPosts.pageInfo.hasNextPage ? last.userPosts.pageInfo.endCursor : null,
  });

  const posts = query.data?.pages.flatMap((p) => p.userPosts.nodes) ?? [];
  return (
    <FeedList
      posts={posts}
      isLoading={query.isLoading}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      fetchNextPage={query.fetchNextPage}
      emptyText="No posts yet."
    />
  );
}

function MyPostList({ queryKey }: { queryKey: 'myLikedPosts' | 'myBookmarkedPosts' }) {
  const document =
    queryKey === 'myLikedPosts' ? MY_LIKED_POSTS_QUERY : MY_BOOKMARKED_POSTS_QUERY;
  const query = useInfiniteQuery({
    queryKey: [queryKey],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      gql<Record<typeof queryKey, PostConn>>(document, {
        after: pageParam ?? null,
      }),
    getNextPageParam: (last) =>
      last[queryKey].pageInfo.hasNextPage ? last[queryKey].pageInfo.endCursor : null,
  });
  const posts = query.data?.pages.flatMap((p) => p[queryKey].nodes) ?? [];
  return (
    <FeedList
      posts={posts}
      isLoading={query.isLoading}
      hasNextPage={query.hasNextPage}
      isFetchingNextPage={query.isFetchingNextPage}
      fetchNextPage={query.fetchNextPage}
      emptyText={queryKey === 'myLikedPosts' ? 'No liked posts yet.' : 'No bookmarks yet.'}
    />
  );
}

function FeedList({
  posts,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyText,
}: {
  posts: PostNode[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  emptyText: string;
}) {
  if (isLoading) {
    return <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>;
  }
  if (!posts.length) {
    return <Card className="text-center text-[var(--color-fg-muted)]">{emptyText}</Card>;
  }
  return (
    <div className="flex flex-col gap-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {hasNextPage ? (
        <div className="grid place-items-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface CommentRow {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; fullName: string; avatarUrl: string | null };
}

function CommentsList({ username, isSelf }: { username: string; isSelf: boolean }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['userComments', username],
    queryFn: () => gql<{ userComments: CommentRow[] }>(USER_COMMENTS_QUERY, { username }),
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function deleteComment(id: string) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await gql(DELETE_COMMENT_MUTATION, { commentId: id });
      qc.invalidateQueries({ queryKey: ['userComments', username] });
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  if (query.isLoading) {
    return <div className="py-10 text-center text-[var(--color-fg-muted)]">Loading…</div>;
  }
  const rows = query.data?.userComments ?? [];
  if (!rows.length) {
    return <Card className="text-center text-[var(--color-fg-muted)]">No comments yet.</Card>;
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((c) =>
        editingId === c.id ? (
          <CommentEditor
            key={c.id}
            comment={c}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              qc.invalidateQueries({ queryKey: ['userComments', username] });
            }}
          />
        ) : (
          <Card key={c.id} className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <Link
                href={`/p/${c.postId}`}
                className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                on a post · {relativeTime(c.createdAt)}
              </Link>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
            {isSelf ? (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditingId(c.id)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteComment(c.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
          </Card>
        ),
      )}
    </div>
  );
}

function CommentEditor({
  comment,
  onSaved,
  onCancel,
}: {
  comment: CommentRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await gql(UPDATE_COMMENT_MUTATION, { commentId: comment.id, body });
      onSaved();
    } catch (e) {
      setErr((e as Error).message ?? 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-3">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-20" />
      {err ? <p className="mt-1 text-xs text-[var(--color-danger)]">{err}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
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
