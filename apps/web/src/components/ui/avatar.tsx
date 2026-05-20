import { cn, initialsOf } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 36, className }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn('rounded-full object-cover border border-[var(--color-border)]', className)}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-lo)]',
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  );
}
