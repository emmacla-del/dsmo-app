"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "./api-client";

// Same pattern as onefop/preview/page.tsx's inline useAuthState/
// useRequireAuth (not re-exported from there to avoid touching that
// already-verified file, and because a concurrent session is actively
// working on the auth surface this session — duplicating a few lines here
// is safer than refactoring a shared dependency mid-flight; worth
// de-duplicating once both slices have landed).
export type AuthState = "checking" | "authed" | "anon";

function subscribeNoop() {
  return () => {};
}

function useAuthState(): AuthState {
  return useSyncExternalStore(
    subscribeNoop,
    () => (getToken() ? "authed" : "anon"),
    () => "checking",
  );
}

export function useRequireAuth(): AuthState {
  const router = useRouter();
  const authState = useAuthState();

  useEffect(() => {
    if (authState === "anon") router.replace("/");
  }, [authState, router]);

  return authState;
}
