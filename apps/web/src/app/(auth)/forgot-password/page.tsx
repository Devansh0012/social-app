'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import { REQUEST_PASSWORD_RESET_MUTATION } from '@/lib/queries';

interface RequestResult {
  requestPasswordReset: { ok: boolean; resetTokenDev: string | null };
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await gql<RequestResult>(
        REQUEST_PASSWORD_RESET_MUTATION,
        { email },
        { withAuth: false },
      );
      setSent(true);
      setDevToken(data.requestPasswordReset.resetTokenDev);
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for {email}, a reset link is on its way. It expires in an hour.
          </CardDescription>
        </CardHeader>
        {devToken ? (
          <p className="text-sm text-[var(--color-fg-muted)]">
            Dev mode:{' '}
            <Link
              href={`/reset-password?token=${devToken}`}
              className="text-[var(--color-brand-hi)] hover:underline"
            >
              open the reset link
            </Link>
          </p>
        ) : null}
        <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
          <Link href="/login" className="text-[var(--color-brand-hi)] hover:underline">
            Back to login
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Enter your college email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm text-[var(--color-fg-muted)]">
          Email
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </label>
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
        Remembered it?{' '}
        <Link href="/login" className="text-[var(--color-brand-hi)] hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
