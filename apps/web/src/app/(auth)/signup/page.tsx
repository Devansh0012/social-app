'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import { SIGNUP_MUTATION } from '@/lib/queries';
import { useAuthStore, type Viewer } from '@/lib/auth-store';

interface SignupResult {
  signup: {
    viewer: Viewer;
    tokens: { accessToken: string; refreshToken: string };
    verifyTokenDev: string | null;
  };
}

export default function SignupPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await gql<SignupResult>(SIGNUP_MUTATION, {
        input: form,
      });
      setSession({
        viewer: data.signup.viewer,
        accessToken: data.signup.tokens.accessToken,
        refreshToken: data.signup.tokens.refreshToken,
      });
      if (data.signup.verifyTokenDev) {
        router.push(`/verify-email?token=${data.signup.verifyTokenDev}`);
      } else {
        router.push('/onboarding');
      }
    } catch (err) {
      const code = errorCode(err);
      if (code === 'COLLEGE_EMAIL_REQUIRED') {
        setError(
          'That email domain isn’t in our college list yet. Make sure you’re using your campus email.',
        );
      } else {
        setError(errorMessage(err) ?? 'Sign up failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Verified by college email — that’s it.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm text-[var(--color-fg-muted)]">
          Full name
          <Input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Ada Lovelace"
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          College email
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@university.edu"
            className="mt-1"
          />
        </label>
        <label className="text-sm text-[var(--color-fg-muted)]">
          Password
          <Input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1"
          />
        </label>
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
        Already a member?{' '}
        <Link href="/login" className="text-[var(--color-brand-hi)] hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}

function errorMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const first = (err as { response?: { errors?: Array<{ message?: string }> } }).response
      ?.errors?.[0];
    if (first?.message) return first.message;
  }
  if (err instanceof Error) return err.message;
  return null;
}
function errorCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const first = (
      err as { response?: { errors?: Array<{ extensions?: { code?: string } }> } }
    ).response?.errors?.[0];
    if (first?.extensions?.code) return first.extensions.code;
  }
  return null;
}
