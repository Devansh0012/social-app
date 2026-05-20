import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'brand' | 'success' | 'warn' | 'danger';
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  const toneClass = {
    neutral:
      'bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] border-[var(--color-border)]',
    brand: 'bg-[var(--color-brand)]/15 text-[var(--color-brand-hi)] border-[var(--color-brand)]/30',
    success: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30',
    warn: 'bg-[var(--color-warn)]/15 text-[var(--color-warn)] border-[var(--color-warn)]/30',
    danger: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClass,
        className,
      )}
      {...props}
    />
  );
}
