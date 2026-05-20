'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { gql } from '@/lib/graphql-client';
import { COMPLETE_ONBOARDING_MUTATION, USERNAME_CHECK_QUERY } from '@/lib/queries';
import { useAuthStore, type Viewer } from '@/lib/auth-store';

const SUGGESTED_INTERESTS = [
  'AI',
  'Hardware',
  'Competitive Programming',
  'Hackathons',
  'Startups',
  'Placements',
  'Open Source',
  'Design',
  'Web Dev',
  'Mobile',
  'Robotics',
  'ML Research',
];

export default function OnboardingPage() {
  const router = useRouter();
  const viewer = useAuthStore((s) => s.viewer);
  const setViewer = useAuthStore((s) => s.setViewer);

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(viewer?.username ?? '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>(
    'idle',
  );
  const [department, setDepartment] = useState('');
  const [graduationYear, setGraduationYear] = useState<number>(new Date().getFullYear() + 1);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillsInput, setSkillsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!viewer) router.replace('/login');
  }, [viewer, router]);

  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const data = await gql<{ isUsernameAvailable: { available: boolean } }>(
          USERNAME_CHECK_QUERY,
          { username },
        );
        setUsernameStatus(data.isUsernameAvailable.available ? 'ok' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [username]);

  function toggleInterest(tag: string) {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 10),
    );
  }

  function addSkill(raw: string) {
    const t = raw.trim();
    if (!t) return;
    setSkills((prev) => (prev.includes(t) ? prev : [...prev, t].slice(0, 15)));
    setSkillsInput('');
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await gql<{ completeOnboarding: Viewer }>(COMPLETE_ONBOARDING_MUTATION, {
        input: {
          username,
          department,
          graduationYear,
          interests,
          skills,
          bio: bio || undefined,
        },
      });
      setViewer(data.completeOnboarding);
      router.push('/feed');
    } catch (err) {
      setError((err as Error).message ?? 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!viewer) return null;

  return (
    <main className="bx-grid-bg flex min-h-dvh items-start justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Set up your profile</CardTitle>
          <CardDescription>Step {step + 1} of 3 — takes about a minute.</CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {step === 0 && (
            <>
              <label className="text-sm text-[var(--color-fg-muted)]">
                Username
                <Input
                  required
                  minLength={3}
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ada_lovelace"
                  className="mt-1"
                />
                <span className="mt-1 inline-block text-xs">
                  {usernameStatus === 'checking' && <span>Checking…</span>}
                  {usernameStatus === 'ok' && (
                    <span className="text-[var(--color-accent)]">✓ Available</span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-[var(--color-danger)]">Taken — pick another</span>
                  )}
                </span>
              </label>
              <label className="text-sm text-[var(--color-fg-muted)]">
                Short bio
                <Textarea
                  maxLength={280}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Building cool things in college…"
                  className="mt-1"
                />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <label className="text-sm text-[var(--color-fg-muted)]">
                College
                <Input value={viewer.college?.name ?? ''} readOnly className="mt-1" />
              </label>
              <label className="text-sm text-[var(--color-fg-muted)]">
                Department
                <Input
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Computer Science"
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-[var(--color-fg-muted)]">
                Graduation year
                <Input
                  type="number"
                  min={new Date().getFullYear() - 1}
                  max={new Date().getFullYear() + 8}
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(parseInt(e.target.value, 10))}
                  className="mt-1"
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <p className="text-sm text-[var(--color-fg-muted)]">
                  Pick a few interests — we’ll tune your feed.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTED_INTERESTS.map((t) => {
                    const active = interests.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleInterest(t)}
                        className={
                          active
                            ? 'rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/15 px-3 py-1 text-xs text-[var(--color-brand-hi)]'
                            : 'rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1 text-xs text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]'
                        }
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--color-fg-muted)]">Skills (optional)</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {skills.map((s) => (
                    <Badge key={s} tone="brand">
                      {s}
                      <button
                        type="button"
                        onClick={() => setSkills(skills.filter((x) => x !== s))}
                        className="ml-1 text-[10px]"
                      >
                        ✕
                      </button>
                    </Badge>
                  ))}
                  <Input
                    placeholder="Add and press Enter"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill(skillsInput);
                      }
                    }}
                    className="max-w-xs"
                  />
                </div>
              </div>
            </>
          )}

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

          <div className="mt-2 flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < 2 ? (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && usernameStatus !== 'ok'}
              >
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={submitting || interests.length === 0}>
                {submitting ? 'Saving…' : 'Finish'}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </main>
  );
}
