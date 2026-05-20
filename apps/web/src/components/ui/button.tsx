'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hi)] shadow-[0_4px_20px_-6px_rgba(99,102,241,0.45)]',
        ghost:
          'bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-bg-card)]',
        secondary:
          'bg-[var(--color-bg-card)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
        outline:
          'bg-transparent border border-[var(--color-border-strong)] text-[var(--color-fg)] hover:bg-[var(--color-bg-card)]',
        danger:
          'bg-[var(--color-danger)]/15 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';
