'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Viewer {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  college: { id: string; name: string; domain: string } | null;
  department: string | null;
  graduationYear: number | null;
  interests: string[];
  skills: string[];
  socialLinks: Record<string, string> | null;
  role: 'USER' | 'ADMIN';
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'BANNED';
  emailVerified: boolean;
  isVerifiedStudent: boolean;
  onboardingCompleted: boolean;
  reputationScore: number;
  createdAt: string;
}

interface AuthState {
  viewer: Viewer | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (input: { viewer: Viewer; accessToken: string; refreshToken: string }) => void;
  setViewer: (viewer: Viewer | null) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      viewer: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ viewer, accessToken, refreshToken }) =>
        set({ viewer, accessToken, refreshToken }),
      setViewer: (viewer) => set({ viewer }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clear: () => set({ viewer: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'braventex.auth' },
  ),
);

/**
 * True once the persisted auth state has been read from localStorage.
 * Before this is true, treat the auth state as "unknown" — don't redirect.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
