import type { UserRole } from "@/lib/user-types";

// Admin console navigation & routes — the single source of truth for the 6 primary
// hubs, their secondary sub-routes, and the per-page role gate (role-decisions D8).
//
// allowedRoles is the UNION of roles that can do anything on the page,
// derived from the backend @Roles on the endpoints the page calls. It is UX,
// not security: the backend still enforces every action.
//
// allowedRoles undefined = no per-page gate (visible to every console role).

export type HubKey =
  | "supervision"
  | "collecte"
  | "declarants"
  | "qualite"
  | "donnees"
  | "administration";

export interface AdminSubRoute {
  label: string;
  href: string;
  badgeKey?: "pending" | "inscriptions" | "anomalies";
  allowedRoles?: UserRole[];
}

export interface AdminHub {
  key: HubKey;
  label: string;
  href: string;
  iconName: "dashboard" | "collecte" | "declarants" | "quality" | "data" | "settings";
  matchPrefixes: string[];
  badgeKey?: "pending" | "inscriptions" | "anomalies";
  allowedRoles?: UserRole[];
  subRoutes: AdminSubRoute[];
}

export interface AdminRoute {
  label: string;
  href: string | null;
  allowedRoles?: UserRole[];
}

export interface AdminRouteSection {
  group: string;
  items: AdminRoute[];
}

const SUPER_ADMINS: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_DSMO", "SUPER_ADMIN_ONEFOP"];
const DOSSIER_ROLES: UserRole[] = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "DIVISIONAL"];

export const ADMIN_HUBS: AdminHub[] = [
  {
    key: "supervision",
    label: "Supervision",
    href: "/admin/pilotage",
    iconName: "dashboard",
    badgeKey: "pending",
    matchPrefixes: ["/admin/pilotage", "/admin/files-attente"],
    subRoutes: [
      { label: "Tableau de bord", href: "/admin/pilotage" },
      { label: "Dossiers en instance", href: "/admin/files-attente", badgeKey: "pending" },
      { label: "Activité & alertes", href: "/admin/pilotage#activity" },
    ],
  },
  {
    key: "collecte",
    label: "Collecte",
    href: "/admin/campagnes",
    iconName: "collecte",
    matchPrefixes: ["/admin/campagnes", "/admin/questionnaires"],
    subRoutes: [
      { label: "Campagnes", href: "/admin/campagnes" },
      { label: "Questionnaires", href: "/admin/questionnaires" },
    ],
  },
  {
    key: "declarants",
    label: "Déclarants",
    href: "/admin/inscriptions",
    iconName: "declarants",
    badgeKey: "inscriptions",
    matchPrefixes: ["/admin/inscriptions", "/admin/etablissements", "/admin/etablissement-detail"],
    subRoutes: [
      { label: "Inscriptions", href: "/admin/inscriptions", badgeKey: "inscriptions" },
      { label: "Établissements", href: "/admin/etablissements" },
      { label: "Annuaire déclarants", href: "/home/annuaire?tab=users" },
    ],
  },
  {
    key: "qualite",
    label: "Contrôle Qualité",
    href: "/admin/dossiers",
    iconName: "quality",
    badgeKey: "anomalies",
    matchPrefixes: ["/admin/dossiers"],
    subRoutes: [
      { label: "Visas & décisions", href: "/admin/dossiers" },
      { label: "Anomalies", href: "/admin/files-attente?tab=anomalies", badgeKey: "anomalies" },
      { label: "Contrôle régional", href: "/admin/dossiers?status=PENDING_REVIEW" },
    ],
  },
  {
    key: "donnees",
    label: "Données",
    href: "/admin/centre-qualite",
    iconName: "data",
    matchPrefixes: ["/admin/centre-qualite", "/admin/sectors", "/admin/diffusion"],
    subRoutes: [
      { label: "Centre Qualité", href: "/admin/centre-qualite" },
      { label: "Jeux de données (Secteurs)", href: "/admin/sectors" },
      { label: "Gestion & Exports", href: "/admin/diffusion" },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    href: "/admin/parametres",
    iconName: "settings",
    matchPrefixes: ["/admin/parametres", "/admin/utilisateurs", "/admin/journal-audit"],
    subRoutes: [
      { label: "Paramètres généraux", href: "/admin/parametres" },
      { label: "Utilisateurs ONEFOP", href: "/admin/utilisateurs" },
      { label: "Journal d'audit", href: "/admin/journal-audit" },
    ],
  },
];

/** Backward compatible sectioned routes structure */
export const ADMIN_ROUTES: AdminRouteSection[] = ADMIN_HUBS.map((hub) => ({
  group: hub.label,
  items: hub.subRoutes.map((sub) => ({
    label: sub.label,
    href: sub.href,
    allowedRoles: sub.allowedRoles,
  })),
}));

/** True when a route with these allowedRoles may be shown to `role`. */
export function isRoleAllowed(allowedRoles: UserRole[] | undefined, role: UserRole | undefined): boolean {
  if (!allowedRoles) return true;
  return !!role && allowedRoles.includes(role);
}

/**
 * Roles allowed on `pathname`: those of the longest matching route prefix,
 * or null when no gated route matches (no per-page gate).
 */
export function getAllowedRoles(pathname: string): UserRole[] | null {
  let best: AdminSubRoute | undefined;
  for (const hub of ADMIN_HUBS) {
    for (const route of hub.subRoutes) {
      const cleanHref = route.href.split(/[?#]/)[0];
      if (!(pathname === cleanHref || pathname.startsWith(cleanHref + "/"))) continue;
      if (!best || cleanHref.length > best.href.split(/[?#]/)[0].length) {
        best = route;
      }
    }
  }
  return best?.allowedRoles ?? null;
}

/**
 * Finds the active Hub for the current pathname and query params.
 */
export function getActiveHub(pathname: string, searchParams?: URLSearchParams | null): AdminHub | undefined {
  // 1. Exact query-matched subRoute
  for (const hub of ADMIN_HUBS) {
    for (const sub of hub.subRoutes) {
      const [subPath, subQuery] = sub.href.split("?");
      if (subPath === pathname && subQuery && searchParams) {
        const params = new URLSearchParams(subQuery);
        let allMatch = true;
        params.forEach((val, key) => {
          if (searchParams.get(key) !== val) allMatch = false;
        });
        if (allMatch) return hub;
      }
    }
  }

  // 2. Exact or prefix-matched matchPrefixes
  for (const hub of ADMIN_HUBS) {
    if (hub.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return hub;
    }
  }

  return undefined;
}

/**
 * Checks if a specific sub-route is active given the pathname and searchParams.
 */
export function isSubRouteActive(subHref: string, pathname: string, searchParams?: URLSearchParams | null, allHubSubRoutes?: AdminSubRoute[]): boolean {
  const [subPath, subQuery] = subHref.split("?");
  const cleanPath = subPath.split("#")[0];

  if (pathname !== cleanPath) return false;

  if (subQuery) {
    if (!searchParams) return false;
    const params = new URLSearchParams(subQuery);
    let allMatch = true;
    params.forEach((val, key) => {
      if (searchParams.get(key) !== val) allMatch = false;
    });
    return allMatch;
  }

  // If subHref has no query, but current URL has a query that another subRoute in the same hub specializes:
  if (allHubSubRoutes) {
    const hasMoreSpecificMatch = allHubSubRoutes.some((other) => {
      if (other.href === subHref) return false;
      const [oPath, oQuery] = other.href.split("?");
      if (oPath !== cleanPath || !oQuery || !searchParams) return false;
      const oParams = new URLSearchParams(oQuery);
      let match = true;
      oParams.forEach((val, key) => {
        if (searchParams.get(key) !== val) match = false;
      });
      return match;
    });
    if (hasMoreSpecificMatch) return false;
  }

  return true;
}
