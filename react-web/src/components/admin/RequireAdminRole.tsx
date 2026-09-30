"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { getAllowedRoles, isRoleAllowed } from "@/app/admin/_routes";

// Per-page role gate (role-decisions D8), rendered by the admin layout inside
// the console-level useAdminScreenGuard(ADMIN_ROLES) gate. A role outside the
// page's allowedRoles is sent to /admin/pilotage — its sidebar item is hidden,
// so the page simply does not exist for it. Nothing of the page is rendered
// meanwhile, so its queries never fire and 403. UX only: the backend still
// enforces every endpoint.
export function RequireAdminRole({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);

  const allowed = isRoleAllowed(getAllowedRoles(pathname) ?? undefined, role);

  useEffect(() => {
    if (!allowed) router.replace("/admin/pilotage");
  }, [allowed, router]);

  return allowed ? <>{children}</> : null;
}
