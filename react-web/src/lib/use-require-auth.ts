"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getToken } from "./api-client";

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

