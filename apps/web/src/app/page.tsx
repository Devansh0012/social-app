import Link from 'next/link';
import { ArrowRight, Sparkles, Users, BookMarked, Rocket } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="bx-grid-bg min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)] text-white">
            B
          </span>
          braventex
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-hi)] transition"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-16 text-center md:pt-24">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1 text-xs text-[var(--color-fg-muted)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--color-brand-hi)]" />
          Invite-only to verified college students
        </span>

        <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          A campus, <span className="bx-gradient-text">not a feed.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-[var(--color-fg-muted)] md:text-xl">
          Communities, collaboration, study rooms, and a feed worth scrolling. Built for students,
          gated by your college email — no doom-scroll, just signal.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand)] px-6 py-3 text-base font-medium text-white hover:bg-[var(--color-brand-hi)] transition shadow-[0_8px_32px_-12px_rgba(99,102,241,0.6)]"
          >
            Join with your college email
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-transparent px-6 py-3 text-base font-medium text-[var(--color-fg)] hover:bg-[var(--color-bg-card)] transition"
          >
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-28 grid w-full max-w-6xl grid-cols-1 gap-4 px-6 md:grid-cols-3">
        <FeatureCard
          icon={<Users className="h-5 w-5" />}
          title="Communities that mean something"
          body="Run a club, a hackathon team, or a study group. Public, restricted, or private — your call."
        />
        <FeatureCard
          icon={<Rocket className="h-5 w-5" />}
          title="Find your next collab"
          body="Post 'Looking for Collaborators', list skills, ship faster. Applications, not cold DMs."
        />
        <FeatureCard
          icon={<BookMarked className="h-5 w-5" />}
          title="Notes, decks, & study rooms"
          body="Browse uploaded study material by college, department, and semester. Hop into focus rooms with built-in pomodoro."
        />
      </section>

      <footer className="mx-auto mt-32 w-full max-w-6xl px-6 pb-10 text-sm text-[var(--color-fg-subtle)]">
        © {new Date().getFullYear()} Braventex. Built for students.
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bx-card p-6 transition hover:border-[var(--color-border-strong)]">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand-hi)]">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{body}</p>
    </div>
  );
}
