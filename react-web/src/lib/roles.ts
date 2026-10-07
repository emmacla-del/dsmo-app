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

/** The values of prisma's UserRole enum, in schema order. */
export type UserRole =
  | "COMPANY"
  | "SUPER_ADMIN"
  | "ADMIN_ONEFOP"
  | "REGIONAL_ADMIN"
  | "DIVISIONAL_ADMIN"
  | "AUDITOR"
  | "CENTRAL_AGENT";

/** Every role, for exhaustiveness checks and option lists. */
export const ALL_ROLES: readonly UserRole[] = [
  "COMPANY",
  "SUPER_ADMIN",
  "ADMIN_ONEFOP",
  "REGIONAL_ADMIN",
  "DIVISIONAL_ADMIN",
  "AUDITOR",
  "CENTRAL_AGENT",
];

/**
 * Staff of the central and attached services who are not administrators:
 * national, read-only (backend READ_ONLY_NATIONAL_ROLES). They open the
 * pilotage dashboard, the dossiers and the establishment directory, and no
 * action control is shown to them -- the server refuses every mutation and
 * export to the role regardless.
 */
export const READ_ONLY_ROLES: readonly UserRole[] = ["CENTRAL_AGENT"];

/** True for a role that may look but never act. */
export function isReadOnlyRole(role: string | null | undefined): boolean {
  return hasRole(role, READ_ONLY_ROLES);
}

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
  "CENTRAL_AGENT",
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
 * Who may READ the establishment directory and an establishment's detail:
 * DIRECTORY_ROLES plus the read-only central staff. Kept apart from
 * DIRECTORY_ROLES, which also gates registering an establishment on a
 * company's behalf (/admin/inscriptions/nouvelle).
 */
export const DIRECTORY_READ_ROLES: readonly UserRole[] = [...DIRECTORY_ROLES, ...READ_ONLY_ROLES];

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
 * Territorial admin monitoring (/admin/equipe) and the nudge action. Mirrors
 * @Roles on GET /audit/actor-summary and POST /audit/nudge; a REGIONAL_ADMIN
 * is narrowed to its own region server-side.
 */
export const MONITORING_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN_ONEFOP", "REGIONAL_ADMIN"];

/**
 * Readers of GET /data-management/stats. Source of truth: the @Roles on
 * getDataStats in src/data-management/data-management.controller.ts:56.
 * DIVISIONAL_ADMIN and AUDITOR are refused there. Same membership as
 * MONITORING_ROLES today, but a separate concern.
 */
export const DATA_STATS_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN_ONEFOP", "REGIONAL_ADMIN", "CENTRAL_AGENT"];

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

/**
 * Roles that SEE nationally: NATIONAL_ROLES plus the read-only central
 * staff (backend READ_NATIONAL_ROLES). For labels such as "Portée :
 * nationale" -- never for gating an action, which stays on NATIONAL_ROLES.
 */
export const NATIONAL_READ_ROLES: readonly UserRole[] = [...NATIONAL_ROLES, ...READ_ONLY_ROLES];

/** Territorially-scoped staff: their view is narrowed to their assignment. */
export const TERRITORIAL_ROLES: readonly UserRole[] = ["REGIONAL_ADMIN", "DIVISIONAL_ADMIN"];

/** Convenience predicate; `role` is widened because JWT payloads are untyped. */
export function hasRole(role: string | null | undefined, group: readonly UserRole[]): boolean {
  return !!role && (group as readonly string[]).includes(role);
}