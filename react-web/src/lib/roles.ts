// src/lib/roles.ts
//
// Single source of truth for role identifiers and role groups on the
// frontend. Mirrors prisma UserRole (see the role_model_refactor migration)
// and the backend's own groupings in src/auth/staff-scope.ts and
// src/auth/territory.ts.
//
// These constants gate UI affordances only. Authorization is enforced
// server-side by RolesGuard and the territory helpers; a group here that is
// wider than its backend counterpart shows a control that the API will
// still refuse, never the reverse.
//
// Before role_model_refactor these groups lived as ~40 local arrays across
// src/, several of which had drifted apart. Collapsing eleven roles to six
// made many of them identical in membership. They are still exported under
// distinct names rather than aliased together, so that a later change to
// one concern (say, who may write campaigns) does not silently move the
// others.

/** The six values of prisma's UserRole enum, in schema order. */
export type UserRole =
  | "COMPANY"
  | "SUPER_ADMIN"
  | "ADMIN_ONEFOP"
  | "REGIONAL_ADMIN"
  | "DIVISIONAL_ADMIN"
  | "AUDITOR";

/** Every role, for exhaustiveness checks and option lists. */
export const ALL_ROLES: readonly UserRole[] = [
  "COMPANY",
  "SUPER_ADMIN",
  "ADMIN_ONEFOP",
  "REGIONAL_ADMIN",
  "DIVISIONAL_ADMIN",
  "AUDITOR",
];

/**
 * Any staff account — everyone who may load /admin at all. The complement
 * of COMPANY. Replaces the eleven-value ADMIN_ROLES in admin/layout.tsx.
 * Keeps AUDITOR, which needs the shell to reach /admin/journal-audit; the
 * per-page guards do the narrowing from here.
 */
export const ADMIN_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN_ONEFOP",
  "REGIONAL_ADMIN",
  "DIVISIONAL_ADMIN",
  "AUDITOR",
];

/**
 * Read access to the establishment/company directory and its detail pages.
 * Excludes AUDITOR: the audit role reaches the journal, not the directory.
 */
export const DIRECTORY_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN_ONEFOP",
  "REGIONAL_ADMIN",
  "DIVISIONAL_ADMIN",
];

/**
 * May act on a dossier or a registration: approve, reject, request
 * corrections. Excludes AUDITOR, which is read-only by definition.
 * Mirrors the backend's USER_ADMIN_ROLES + TERRITORIAL_APPROVER_ROLES on
 * the approve/reject routes; territorial narrowing is applied server-side.
 */
export const APPROVAL_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN_ONEFOP",
  "REGIONAL_ADMIN",
  "DIVISIONAL_ADMIN",
];

/** Campaign list and campaign management screens (@Roles on campaign.controller.ts). */
export const CAMPAIGN_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN_ONEFOP",
  "REGIONAL_ADMIN",
];

/** Platform settings and system identity. SUPER_ADMIN alone. */
export const SETTINGS_ROLES: readonly UserRole[] = ["SUPER_ADMIN"];

/**
 * User administration screens. Wider than SETTINGS_ROLES because
 * ADMIN_ONEFOP manages ONEFOP field staff (backend USER_ADMIN_ROLES in
 * src/auth/staff-scope.ts); it cannot reach SUPER_ADMIN or its own rank,
 * which manageableRolesFor enforces server-side.
 */
export const USER_ADMIN_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN_ONEFOP"];

/** Audit log and activity journal readers. */
export const AUDIT_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "AUDITOR"];

/**
 * Roles whose authorized scope is the whole country, so no region or
 * department filter is applied to what they see. Must stay in step with
 * NATIONAL_ROLES in src/auth/territory.ts, which is the enforcing copy.
 *
 * AUDITOR is deliberately absent: it reads nationally on the audit
 * surfaces (see AUDIT_ROLES) but is not a territorial authority. A site
 * that wants both composes them.
 */
export const NATIONAL_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN_ONEFOP"];

/** Territorially-scoped staff: their view is narrowed to their assignment. */
export const TERRITORIAL_ROLES: readonly UserRole[] = ["REGIONAL_ADMIN", "DIVISIONAL_ADMIN"];

/** Convenience predicate; `role` is widened because JWT payloads are untyped. */
export function hasRole(role: string | null | undefined, group: readonly UserRole[]): boolean {
  return !!role && (group as readonly string[]).includes(role);
}
