'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import { LOGIN_MUTATION } from '@/lib/queries';
import { useAuthStore, type Viewer } from '@/lib/auth-store';

interface LoginResult {
  login: {
    viewer: Viewer;
    tokens: { accessToken: string; refreshToken: string };
  };
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await gql<LoginResult>(LOGIN_MUTATION, {
        input: { email, password },
      });
      setSession({
        viewer: data.login.viewer,
        accessToken: data.login.tokens.accessToken,
        refreshToken: data.login.tokens.refreshToken,
      });
      router.push(data.login.viewer.onboardingCompleted ? '/feed' : '/onboarding');
    } catch (err) {
      const message = extractMessage(err) ?? 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Log in with your college email.</CardDescription>
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
        <label className="text-sm text-[var(--color-fg-muted)]">
          Password
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
        </label>
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
        <p className="text-right text-sm">
          <Link
            href="/forgot-password"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
        New here?{' '}
        <Link href="/signup" className="text-[var(--color-brand-hi)] hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

function extractMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const first = (err as { response?: { errors?: Array<{ message?: string }> } }).response
      ?.errors?.[0];
    if (first?.message) return first.message;
  }
  if (err instanceof Error) return err.message;
  return null;
}
