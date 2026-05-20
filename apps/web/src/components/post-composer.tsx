'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Image as ImageIcon, Link2, Sparkles } from 'lucide-react';
import { gql } from '@/lib/graphql-client';
import { CREATE_POST_MUTATION } from '@/lib/queries';
import { useAuthStore } from '@/lib/auth-store';

export function PostComposer({
  onPosted,
  communityId,
}: {
  onPosted?: () => void;
  communityId?: string | null;
}) {
  const viewer = useAuthStore((s) => s.viewer);
  const [body, setBody] = useState('');
  const [type, setType] = useState<'TEXT' | 'LINK'>('TEXT');
  const [linkUrl, setLinkUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (type === 'TEXT' && !body.trim()) return;
    if (type === 'LINK' && !linkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await gql(CREATE_POST_MUTATION, {
        input: {
          type,
          body: type === 'TEXT' ? body : body || undefined,
          linkUrl: type === 'LINK' ? linkUrl : undefined,
          communityId: communityId ?? undefined,
        },
      });
      setBody('');
      setLinkUrl('');
      onPosted?.();
    } catch (err) {
      setError((err as Error).message ?? 'Could not post');
    } finally {
      setBusy(false);
    }
  }

  if (!viewer) return null;
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Avatar src={viewer.avatarUrl} name={viewer.fullName} size={36} />
        <div className="flex-1">
          <Textarea
            placeholder={`What's on your mind, ${viewer.fullName.split(' ')[0]}?`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-20 border-0 bg-transparent p-0 focus:border-0 focus:ring-0"
          />
          {type === 'LINK' ? (
            <input
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm"
            />
          ) : null}
          {error ? <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p> : null}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1 text-[var(--color-fg-muted)]">
              <button
                type="button"
                onClick={() => setType('TEXT')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-[var(--color-bg-elevated)] ${type === 'TEXT' ? 'text-[var(--color-fg)]' : ''}`}
              >
                <Sparkles className="h-3 w-3" />
                Text
              </button>
              <button
                type="button"
                onClick={() => setType('LINK')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-[var(--color-bg-elevated)] ${type === 'LINK' ? 'text-[var(--color-fg)]' : ''}`}
              >
                <Link2 className="h-3 w-3" />
                Link
              </button>
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-1 rounded-md px-2 py-1 text-xs opacity-50"
                title="Image upload coming soon"
              >
                <ImageIcon className="h-3 w-3" />
                Image
              </button>
            </div>
            <Button onClick={submit} disabled={busy} size="sm">
              {busy ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
