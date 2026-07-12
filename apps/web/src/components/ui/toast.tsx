'use client';

import { create } from 'zustand';
import { cn } from '@/lib/utils';

type ToastKind = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind: ToastKind) => void;
  dismiss: (id: number) => void;
}

const TOAST_TTL_MS = 4000;
let nextId = 1;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_TTL_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, kind: ToastKind = 'info') {
  useToastStore.getState().push(message, kind);
}

export function toastError(err: unknown, fallback: string) {
  // graphql-request's ClientError serializes the whole response into
  // err.message; the human-readable message is in response.errors[0].
  const gqlMessage = (err as { response?: { errors?: Array<{ message?: string }> } })?.response
    ?.errors?.[0]?.message;
  toast(gqlMessage ?? fallback, 'error');
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'bx-card pointer-events-auto max-w-md px-4 py-2.5 text-left text-sm shadow-lg',
            t.kind === 'error' && 'border-[var(--color-danger)]/50 text-[var(--color-danger)]',
            t.kind === 'success' && 'border-[var(--color-brand)]/50',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
