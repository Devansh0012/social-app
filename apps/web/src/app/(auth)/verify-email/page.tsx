'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { gql } from '@/lib/graphql-client';
import { VERIFY_EMAIL_MUTATION } from '@/lib/queries';
import { useAuthStore, type Viewer } from '@/lib/auth-store';

// Module-level cache so React StrictMode's double-effect can't fire the
// verify mutation twice — the second mount reuses the same in-flight promise.
const inflight = new Map<string, Promise<Viewer>>();

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifying your email…</CardTitle>
        <CardDescription>Hang tight.</CardDescription>
      </CardHeader>
    </Card>
  );
}

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const setViewer = useAuthStore((s) => s.setViewer);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    let cancelled = false;
    setStatus('verifying');

    let pending = inflight.get(token);
    if (!pending) {
      pending = gql<{ verifyEmail: Viewer }>(VERIFY_EMAIL_MUTATION, { token }).then(
        (data) => data.verifyEmail,
      );
      inflight.set(token, pending);
    }

    pending
      .then((viewer) => {
        if (cancelled) return;
        setViewer(viewer);
        setStatus('done');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setMessage((err as Error).message ?? 'Verification failed');
        inflight.delete(token);
      });

    return () => {
      cancelled = true;
    };
  }, [token, setViewer]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === 'done'
            ? 'Email verified ✓'
            : status === 'error'
              ? 'Verification problem'
              : 'Verifying your email…'}
        </CardTitle>
        <CardDescription>
          {status === 'done'
            ? 'You’re a verified student now. Let’s finish setting up your profile.'
            : status === 'error'
              ? message
              : 'Hang tight.'}
        </CardDescription>
      </CardHeader>
      {status === 'done' ? (
        <Button onClick={() => router.push('/onboarding')}>Continue to onboarding</Button>
      ) : null}
    </Card>
  );
}
