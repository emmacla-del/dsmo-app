import type { UserRole } from "@/lib/user-types";

// Admin console routes — the single source of truth for the sidebar and for
// the per-page role gate (role-decisions D8). The console-level gate stays in
// layout.tsx (useAdminScreenGuard(ADMIN_ROLES)); this list only narrows it.
//
// allowedRoles is the UNION of roles that can do anything on the page,
// derived from the backend @Roles on the endpoints the page calls. It is UX,
// not security: the backend still enforces every action.
//
// allowedRoles undefined = no per-page gate (visible to every console role).
// That is deliberate for /admin/pilotage, the redirect target (gating it could
// loop), and for the unimplemented href: null items, whose roles are not
// settled yet — fill them in when each page ships.

export interface AdminRoute {
  label: string;
  href: string | null; // null = not yet implemented (rendered as non-link span)
  allowedRoles?: UserRole[];
}

export interface AdminRouteSection {
  group: string;
  items: AdminRoute[];
}

const SUPER_ADMINS: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"];

// @Roles on AdminQuestionnairesController (class-level).
const DOSSIER_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "DIVISIONAL"];

// Sidebar structure mirrors the Figma dashboard.png sidebar exactly. Routes
// that exist today are wired; unimplemented pages use href: null.
export const ADMIN_ROUTES: AdminRouteSection[] = [
  {
    group: "Supervision",
    items: [
      { label: "Tableau de bord",      href: "/admin/pilotage" },
      { label: "Dossiers en instance", href: "/admin/files-attente", allowedRoles: DOSSIER_ROLES },
      { label: "Activité & alertes",   href: null },
    ],
  },
  {
    group: "Collecte",
    items: [
      // GET /campaigns and GET /campaigns/:id; CAMPAIGN_MANAGER has no campaign endpoint.
      { label: "Campagnes",      href: "/admin/campagnes", allowedRoles: [...SUPER_ADMINS, "CENTRAL", "REGIONAL"] },
      { label: "Questionnaires", href: null },
    ],
  },
  {
    group: "Déclarants",
    items: [
      { label: "Inscriptions",   href: null },
      // GET /dsmo/companies; outside /admin, so only the sidebar uses this —
      // the page keeps its own useAdminScreenGuard.
      { label: "Établissements", href: "/home/annuaire", allowedRoles: SUPER_ADMINS },
      { label: "Utilisateurs",   href: null },
    ],
  },
  {
    group: "Contrôle qualité",
    items: [
      { label: "Contrôle régional", href: null },
      { label: "Contrôle national", href: null },
      { label: "Anomalies",         href: null },
      { label: "Visas & décisions", href: "/admin/dossiers", allowedRoles: DOSSIER_ROLES },
    ],
  },
  {
    group: "Données",
    items: [
      { label: "Jeux de données", href: null },
      { label: "Qualité",         href: null },
      // data-management ONEFOP export @Roles (national scope for DSMO/data/analyst per D7).
      {
        label: "Exports",
        href: "/admin/diffusion",
        allowedRoles: [...SUPER_ADMINS, "CENTRAL", "REGIONAL", "DATA_MANAGER", "ANALYST"],
      },
    ],
  },
  {
    group: "Administration",
    items: [
      // GET /auth/users (USER_ADMIN_ROLES). D3's territorial approval ships on Inscriptions.
      { label: "Utilisateurs",        href: "/admin/utilisateurs", allowedRoles: ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP"] },
      { label: "Rôles & permissions", href: null },
      // GET /audit/reports.
      { label: "Journal d'audit",     href: "/admin/journal-audit", allowedRoles: ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "AUDITOR"] },
      // D6: system configuration is SUPER_ADMIN* only.
      { label: "Paramètres",          href: "/admin/parametres", allowedRoles: SUPER_ADMINS },
    ],
  },
];

/** True when a route with these allowedRoles may be shown to `role`. */
export function isRoleAllowed(allowedRoles: UserRole[] | undefined, role: UserRole | undefined): boolean {
  if (!allowedRoles) return true;
  return !!role && allowedRoles.includes(role);
}

/**
 * Roles allowed on `pathname`: those of the longest matching route prefix,
 * or null when no gated route matches (no per-page gate). Prefixes match on a
 * path boundary only, so /admin/dossiers-archive does not match /admin/dossiers.
 */
export function getAllowedRoles(pathname: string): UserRole[] | null {
  let best: AdminRoute | undefined;
  for (const section of ADMIN_ROUTES) {
    for (const route of section.items) {
      const href = route.href;
      if (!href || !(pathname === href || pathname.startsWith(href + "/"))) continue;
      if (!best || href.length > best.href!.length) best = route;
    }
  }
  return best?.allowedRoles ?? null;
}
