"use client";

// src/hooks/usePendingRegistrationsCount.ts
//
// The pending-registration head-count, shared by the sidebar's "Déclarants"
// badge, the "Inscriptions" tab badge (AdminPageHeader) and the pilotage
// "Inscriptions en attente" tile. One hook, so the role gate, the query and
// the refresh rate cannot drift apart between the three — they had.

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listCompanyRegistrations } from "@/lib/user-directory";
import { APPROVAL_ROLES, hasRole } from "@/lib/roles";

/**
 * Source: GET /auth/company-registrations (pageSize 1). Its `counts` cover the
 * whole territory-scoped queue rather than the requested page, so one row
 * buys the figure. Gated to APPROVAL_ROLES, the endpoint's @Roles (USER_ADMIN
 * + TERRITORIAL_APPROVER); disabled, `count` stays null — "not available to
 * this role", not zero.
 *
 * Refreshed every 2 minutes: registrations move at administrative pace, and
 * every poll holds a connection on the session-mode pooler.
 *
 * `enabled` lets a caller hold the request back further (the layout does,
 * until its own guard has resolved).
 */
export function usePendingRegistrationsCount(enabled = true): { canRead: boolean; count: number | null } {
  const role = useAuthStore((s) => s.user?.role);
  const canRead = hasRole(role, APPROVAL_ROLES);
  const query = useQuery({
    queryKey: ["auth", "company-registrations", "pending-count"],
    queryFn: () => listCompanyRegistrations({ page: 1, pageSize: 1 }),
    enabled: enabled && canRead,
    refetchInterval: 120000,
  });
  return { canRead, count: query.data ? query.data.counts.pending : null };
}
