'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import { RESET_PASSWORD_MUTATION } from '@/lib/queries';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>Loading…</CardDescription>
          </CardHeader>
        </Card>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await gql(RESET_PASSWORD_MUTATION, { token, newPassword: password }, { withAuth: false });
      setDone(true);
    } catch (err) {
      setError(extractMessage(err) ?? 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid reset link</CardTitle>
          <CardDescription>This link is missing its token.</CardDescription>
        </CardHeader>
        <p className="text-center text-sm text-[var(--color-fg-muted)]">
          <Link href="/forgot-password" className="text-[var(--color-brand-hi)] hover:underline">
            Request a new one
          </Link>
        </p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Password updated ✓</CardTitle>
          <CardDescription>
            You&apos;ve been signed out everywhere. Log in with your new password.
          </CardDescription>
        </CardHeader>
        <Button onClick={() => router.push('/login')}>Go to login</Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Pick a new password for your account.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm text-[var(--color-fg-muted)]">
          New password
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Confirm password
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1"
          />
        </label>
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Saving…' : 'Reset password'}
        </Button>
      </form>
    </Card>
  );
}

function extractMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const first = (err as { response?: { errors?: Array<{ message?: string }> } }).response
      ?.errors?.[0];
    if (first?.message) return first.message;
  }
  return null;
}
