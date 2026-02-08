import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  displayName: string | null;
  setAuth: (token: string, userId: string, displayName: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      userId: null,
      displayName: null,
      setAuth: (token, userId, displayName) => {
        set({ token, userId, displayName });
      },
      clearAuth: () => {
        set({ token: null, userId: null, displayName: null });
      },
      isAuthenticated: () => {
        return !!get().token;
      },
    }),
    {
      name: 'stream-party-auth',
    }
  )
);
