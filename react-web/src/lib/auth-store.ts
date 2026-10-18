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
  setOnUnauthorized,
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
  /**
   * `intentional` marks the user pressing "Log out", as opposed to the 401
   * handler below signing them out. Only the second should send them to
   * /login with a returnTo (see useRequireAuth): after a deliberate logout
   * that returnTo would sit in the URL and send whoever signs in next on
   * that browser to the previous user's screen.
   */
  logout: (options?: { intentional?: boolean }) => void;
  refreshUser: () => Promise<void>;
}

// Carries the "remember me" choice from the password step through to the
// 2FA code step, the same way Flutter's AuthNotifier._pendingRemember does —
// a 2FA login is two requests sharing one remember decision.
let pendingRemember = true;

/** Waits between profile retries at boot when the server cannot be reached and no profile is cached. */
export const RESTORE_RETRY_DELAYS_MS = [1000, 2000, 4000];

/** The server refused the stored token: the only failure that ends a session at boot. */
function isSessionRefused(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

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
    for (let attempt = 0; ; attempt++) {
      try {
        const user = await getMe();
        // Signed out (or someone else signed in) while /auth/me was in flight:
        // this answer belongs to a session that no longer exists (F10).
        if (getToken() !== token) return;
        cacheUser(user);
        set({ status: "authenticated", user });
        return;
      } catch (e) {
        if (getToken() !== token) return;
        // Only the server refusing the token ends the session: 401, or 403
        // (a rejected or suspended account). apiFetch also throws an ApiError,
        // with status 0, when the server cannot be reached, and a 5xx says
        // nothing about the token either. Treating those as a refusal signed
        // the admin out when the backend restarted (2026-10-16 re-test).
        if (isSessionRefused(e)) {
          clearToken();
          clearCachedUser();
          set({ status: "unauthenticated", user: null });
          return;
        }
        // Not refused: carry on with the cached profile; the next request
        // that reaches the server settles it (a 401 signs out, defect 8).
        const cached = getCachedUser();
        if (cached) {
          set({ status: "authenticated", user: cached });
          return;
        }
        // No profile to show yet: try again, briefly, while the screen waits.
        if (attempt < RESTORE_RETRY_DELAYS_MS.length) {
          await new Promise((resolve) => setTimeout(resolve, RESTORE_RETRY_DELAYS_MS[attempt]));
          if (getToken() !== token) return;
          continue;
        }
        // Still unreachable: the screens need a profile, so show sign-in, but
        // keep the token: it was never refused, and a reload tries it again.
        set({ status: "unauthenticated", user: null });
        return;
      }
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

  logout(options?: { intentional?: boolean }) {
    if (options?.intentional) intentionalLogout = true;
    logoutRequest();
    // D8 fix: Purge local drafts upon logout so user B on a shared computer
    // cannot see or submit user A's figures
    import("./onefop-drafts").then((m) => m.purgeAllDrafts().catch(() => {})).catch(() => {});
    set({ status: "unauthenticated", user: null, twoFactorChallengeToken: null });
  },

  async refreshUser() {
    const token = getToken();
    try {
      const user = await getMe();
      // A late answer must not re-cache the profile of a signed-out session.
      if (!token || getToken() !== token) return;
      cacheUser(user);
      set({ user });
    } catch {
      // Best-effort — keep the existing cached user on failure.
    }
  },
}));

// Set by a deliberate logout and read once by the route guard, which then
// sends the user to the public portal instead of a /login?returnTo=… that
// would outlive their session.
let intentionalLogout = false;

export function consumeIntentionalLogout(): boolean {
  const was = intentionalLogout;
  intentionalLogout = false;
  return was;
}

// Defect 8: when any API request receives a 401, reset the in-memory auth store
// so the screen guards immediately redirect to /login and polling loops halt.
setOnUnauthorized(() => {
  useAuthStore.getState().logout();
});
