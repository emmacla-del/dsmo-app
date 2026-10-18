"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getToken } from "./api-client";
import { consumeIntentionalLogout } from "./auth-store";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (authState === "anon") {
      // The user pressed "Log out". That button does its own navigation —
      // the portal from the respondent home, /login from the admin rail —
      // so the guard stays out of the way. Adding its own
      // /login?returnTo=<the page they just left> on top used to win the
      // race, and that returnTo then outlived the session: the next person
      // to sign in on that browser was sent to the previous user's screen
      // (B11 of the 2026-10-17 run).
      if (consumeIntentionalLogout()) return;
      const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
      const target = (pathname || "") + search;
      const isSafe = target.startsWith("/") && !target.startsWith("//") && !target.includes(":");
      if (isSafe && target !== "/login") {
        const returnTo = encodeURIComponent(target);
        router.replace(`/login?returnTo=${returnTo}`);
      } else {
        router.replace("/login");
      }
    }
  }, [authState, router, pathname, searchParams]);

  return authState;
}

