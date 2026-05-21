'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Compass,
  Users,
  BookOpen,
  Bell,
  ShieldCheck,
  LogOut,
  Sparkles,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthHydrated, useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { gql } from '@/lib/graphql-client';
import { ME_QUERY } from '@/lib/queries';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/feed', label: 'Feed', icon: <Home className="h-4 w-4" /> },
  { href: '/communities', label: 'Communities', icon: <Users className="h-4 w-4" /> },
  { href: '/messages', label: 'Messages', icon: <MessageSquare className="h-4 w-4" /> },
  { href: '/discover', label: 'Discover', icon: <Compass className="h-4 w-4" /> },
  { href: '/study-rooms', label: 'Study Rooms', icon: <BookOpen className="h-4 w-4" /> },
  { href: '/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  {
    href: '/admin',
    label: 'Admin',
    icon: <ShieldCheck className="h-4 w-4" />,
    adminOnly: true,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const viewer = useAuthStore((s) => s.viewer);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setViewer = useAuthStore((s) => s.setViewer);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    if (!viewer) {
      gql<{ me: typeof viewer }>(ME_QUERY)
        .then((data) => {
          if (data.me) setViewer(data.me);
          else router.replace('/login');
        })
        .catch(() => router.replace('/login'));
    } else if (!viewer.onboardingCompleted && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [hydrated, viewer, accessToken, pathname, router, setViewer]);

  if (!hydrated || !viewer) {
    return (
      <div className="grid min-h-dvh place-items-center text-[var(--color-fg-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] md:flex md:flex-col">
        <div className="p-6">
          <Link href="/feed" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)] text-white">
              B
            </span>
            braventex
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.filter((n) => !n.adminOnly || viewer.role === 'ADMIN').map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-[var(--color-bg-card)] text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-fg)]',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3">
          <Link
            href={`/u/${viewer.username}`}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--color-bg-card)]"
          >
            <Avatar src={viewer.avatarUrl} name={viewer.fullName} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="truncate">{viewer.fullName}</span>
                {viewer.isVerifiedStudent ? (
                  <Sparkles className="h-3 w-3 shrink-0 text-[var(--color-brand-hi)]" />
                ) : null}
              </div>
              <div className="truncate text-xs text-[var(--color-fg-muted)]">@{viewer.username}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                clear();
                router.replace('/');
              }}
              aria-label="Log out"
              className="h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_85%,transparent)] px-4 backdrop-blur md:px-8">
          <Link href="/feed" className="md:hidden flex items-center gap-2 font-display font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-brand)] text-white text-sm">
              B
            </span>
            braventex
          </Link>
          <div className="flex flex-1 justify-end">
            <Link href="/communities/new">
              <Button size="sm" variant="primary">
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-24 md:px-8 md:pb-10">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_92%,transparent)] backdrop-blur md:hidden">
          {NAV.filter((n) => !n.adminOnly || viewer.role === 'ADMIN')
            .slice(0, 5)
            .map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 py-2 text-[10px]',
                    active ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]',
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
        </nav>
      </div>
    </div>
  );
}
