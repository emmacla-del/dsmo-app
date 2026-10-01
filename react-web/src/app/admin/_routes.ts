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
      { label: "Dossiers en instance", href: "/admin/files-attente" },
      { label: "Activité & alertes",   href: "/admin/pilotage#activity" },
    ],
  },
  {
    group: "Collecte",
    items: [
      { label: "Campagnes",      href: "/admin/campagnes" },
      { label: "Questionnaires", href: "/admin/questionnaires" },
    ],
  },
  {
    group: "Déclarants",
    items: [
      { label: "Inscriptions",   href: "/admin/inscriptions" },
      { label: "Établissements", href: "/admin/etablissements" },
      { label: "Utilisateurs",   href: "/home/annuaire?tab=users" },
    ],
  },
  {
    group: "Contrôle qualité",
    items: [
      { label: "Contrôle régional", href: "/admin/dossiers?status=PENDING_REVIEW" },
      { label: "Contrôle national", href: "/admin/files-attente?tab=visas" },
      { label: "Anomalies",         href: "/admin/files-attente?tab=anomalies" },
      { label: "Visas & décisions", href: "/admin/dossiers" },
    ],
  },
  {
    group: "Données",
    items: [
      { label: "Jeux de données", href: "/admin/sectors" },
      { label: "Qualité",         href: "/admin/centre-qualite" },
      { label: "Exports",         href: "/admin/diffusion" },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Utilisateurs",        href: "/admin/utilisateurs" },
      { label: "Rôles & permissions", href: "/admin/parametres?tab=utilisateurs" },
      { label: "Journal d'audit",     href: "/admin/journal-audit" },
      { label: "Paramètres",          href: "/admin/parametres" },
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
      if (!href) continue;
      const cleanHref = href.split(/[?#]/)[0];
      if (!(pathname === cleanHref || pathname.startsWith(cleanHref + "/"))) continue;
      if (!best || cleanHref.length > (best.href?.split(/[?#]/)[0].length ?? 0)) best = route;
    }
  }
  return best?.allowedRoles ?? null;
}
