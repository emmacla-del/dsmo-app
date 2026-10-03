"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "./auth-store";
import type { UserRole } from "./roles";

// Named apart from src/lib/use-require-auth.ts on purpose: that file is
// owned by the concurrent Phase 3 session's home-shell guard (token
// presence only, via useAuthStore's sibling getToken() check). This one is
// Phase 1's role-aware guard, built on the fuller auth-store.ts (user
// object + role, not just token presence) for the one screen this slice
// ships. Reconcile into one shared guard once both slices have landed —
// do not silently merge them now while the other session may still be
// editing use-require-auth.ts.
export function useAdminScreenGuard(allowedRoles?: readonly UserRole[]) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const forbidden =
    status === "authenticated" &&
    !!allowedRoles &&
    !!user &&
    !allowedRoles.includes(user.role);

  return {
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    forbidden,
    user,
  };
}
