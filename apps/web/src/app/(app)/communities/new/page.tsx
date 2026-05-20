'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import { CREATE_COMMUNITY_MUTATION } from '@/lib/queries';

interface Created {
  createCommunity: { slug: string };
}

export default function NewCommunityPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'RESTRICTED' | 'PRIVATE'>('PUBLIC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await gql<Created>(CREATE_COMMUNITY_MUTATION, {
        input: {
          name,
          description: description || undefined,
          tags: tags
            ? tags
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
            : undefined,
          privacy,
        },
      });
      router.push(`/c/${data.createCommunity.slug}`);
    } catch (err) {
      setError((err as Error).message ?? 'Could not create community');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a community</CardTitle>
        <CardDescription>Give it a name, a description, and a few tags.</CardDescription>
      </CardHeader>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-sm text-[var(--color-fg-muted)]">
          Name
          <Input
            required
            minLength={3}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Description
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
            maxLength={280}
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Tags (comma-separated)
          <Input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Privacy
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
            className="mt-1 h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm"
          >
            <option value="PUBLIC">Public — anyone can join</option>
            <option value="RESTRICTED">Restricted — anyone can see, members can post</option>
            <option value="PRIVATE">Private — invite only</option>
          </select>
        </label>
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" disabled={busy} className="mt-2">
          {busy ? 'Creating…' : 'Create community'}
        </Button>
      </form>
    </Card>
  );
}
