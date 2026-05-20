import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bx-grid-bg flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-display text-xl font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand)] text-white">
          B
        </span>
        braventex
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
