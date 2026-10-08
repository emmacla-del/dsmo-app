// src/lib/auth-store.ts
//
// Mirrors lib/providers/auth_provider.dart's AuthNotifier: session restore
// on boot, login (with a 2FA branch), logout, and the offline-fallback
// behavior of falling back to a cached profile when /auth/me can't be
// reached rather than logging the user out. Zustand here because auth
// status is genuinely shared across screens (login redirect target, the
// admin route guard, and eventually the Phase 3 nav shell) — the plan's own
// carve-out for when Zustand is appropriate.
"use client";

import { create } from "zustand";
import {
  ApiError,
  cacheUser,
  clearCachedUser,
  clearToken,
  getCachedUser,
  getMe,
  getToken,
  login as loginRequest,
  logoutRequest,
  setToken,
  verifyTwoFactor as verifyTwoFactorRequest,
} from "./api-client";
import type { User } from "./user-types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  submitting: boolean;
  twoFactorChallengeToken: string | null;
  restore: () => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  verifyTwoFactorCode: (code: string) => Promise<void>;
  cancelTwoFactorChallenge: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Carries the "remember me" choice from the password step through to the
// 2FA code step, the same way Flutter's AuthNotifier._pendingRemember does —
// a 2FA login is two requests sharing one remember decision.
let pendingRemember = true;

function messageFrom(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  error: null,
  submitting: false,
  twoFactorChallengeToken: null,

  async restore() {
    const token = getToken();
    if (!token) {
      set({ status: "unauthenticated", user: null });
      return;
    }
    try {
      const user = await getMe();
      cacheUser(user);
      set({ status: "authenticated", user });
    } catch (e) {
      // ApiError means the request reached the server and it rejected the
      // token (e.g. 401) — that's a real logout. A non-ApiError here is a
      // network-level failure (fetch never got a response), which doesn't
      // mean the token is invalid: fall back to the cached profile rather
      // than stranding an offline returning user on the login screen.
      if (!(e instanceof ApiError)) {
        const cached = getCachedUser();
        if (cached) {
          set({ status: "authenticated", user: cached });
          return;
        }
      }
      clearToken();
      clearCachedUser();
      set({ status: "unauthenticated", user: null });
    }
  },

  async login(email, password, remember) {
    pendingRemember = remember;
    set({ submitting: true, error: null });
    try {
      const result = await loginRequest(email, password);
      if ("requiresTwoFactor" in result) {
        set({ submitting: false, twoFactorChallengeToken: result.challengeToken });
        return;
      }
      setToken(result.access_token, remember);
      cacheUser(result.user);
      set({
        submitting: false,
        status: "authenticated",
        user: result.user,
        twoFactorChallengeToken: null,
      });
    } catch (e) {
      set({ submitting: false, error: messageFrom(e) });
    }
  },

  async verifyTwoFactorCode(code) {
    const challengeToken = get().twoFactorChallengeToken;
    if (!challengeToken) return;
    set({ submitting: true, error: null });
    try {
      const result = await verifyTwoFactorRequest(challengeToken, code);
      setToken(result.access_token, pendingRemember);
      cacheUser(result.user);
      set({
        submitting: false,
        status: "authenticated",
        user: result.user,
        twoFactorChallengeToken: null,
      });
    } catch (e) {
      set({ submitting: false, error: messageFrom(e) });
    }
  },

  cancelTwoFactorChallenge() {
    set({ twoFactorChallengeToken: null, error: null });
  },

  logout() {
    logoutRequest();
    // D8 fix: Purge local drafts upon logout so user B on a shared computer
    // cannot see or submit user A's figures
    import("./onefop-drafts").then((m) => m.purgeAllDrafts().catch(() => {})).catch(() => {});
    set({ status: "unauthenticated", user: null, twoFactorChallengeToken: null });
  },

  async refreshUser() {
    try {
      const user = await getMe();
      cacheUser(user);
      set({ user });
    } catch {
      // Best-effort — keep the existing cached user on failure.
    }
  },
}));
