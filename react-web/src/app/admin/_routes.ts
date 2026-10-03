import type { UserRole } from "@/lib/roles";
import {
  ADMIN_ROLES,
  APPROVAL_ROLES,
  AUDIT_ROLES,
  CAMPAIGN_ROLES,
  DIRECTORY_ROLES,
  NATIONAL_ROLES,
  SETTINGS_ROLES,
  USER_ADMIN_ROLES,
} from "@/lib/roles";

// Admin console role-based navigation & permissions single source of truth.
// Maps all 6 primary hubs and their sub-routes to allowed user roles, mirroring
// backend NestJS controller @Roles annotations.
//
// allowedRoles undefined = accessible to all console staff roles.

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
  allowedRoles?: readonly UserRole[];
}

export interface AdminHub {
  key: HubKey;
  label: string;
  href: string;
  iconName: "dashboard" | "collecte" | "declarants" | "quality" | "data" | "settings";
  matchPrefixes: string[];
  badgeKey?: "pending" | "inscriptions" | "anomalies";
  allowedRoles?: readonly UserRole[];
  subRoutes: AdminSubRoute[];
}

export interface AdminRoute {
  label: string;
  href: string | null;
  allowedRoles?: readonly UserRole[];
}

export interface AdminRouteSection {
  group: string;
  items: AdminRoute[];
}

// ── Primary 6 Hubs Definition ────────────────────────────────────────────────

export const ADMIN_HUBS: AdminHub[] = [
  {
    key: "supervision",
    label: "Supervision",
    href: "/admin/pilotage",
    iconName: "dashboard",
    badgeKey: "pending",
    matchPrefixes: ["/admin/pilotage", "/admin/dossiers", "/admin/activite", "/admin/cibles"],
    subRoutes: [
      { label: "Tableau de bord", href: "/admin/pilotage" },
      { label: "Dossiers en instance", href: "/admin/dossiers", badgeKey: "pending", allowedRoles: ADMIN_ROLES },
      { label: "Activité & alertes", href: "/admin/activite" },
      { label: "Cibles et couverture", href: "/admin/cibles", allowedRoles: APPROVAL_ROLES },
    ],
  },
  {
    key: "collecte",
    label: "Collecte",
    href: "/admin/campagnes",
    iconName: "collecte",
    allowedRoles: APPROVAL_ROLES,
    matchPrefixes: ["/admin/campagnes", "/admin/questionnaires"],
    subRoutes: [
      { label: "Campagnes", href: "/admin/campagnes", allowedRoles: CAMPAIGN_ROLES },
      { label: "Questionnaires", href: "/admin/questionnaires", allowedRoles: APPROVAL_ROLES },
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
      { label: "Inscriptions", href: "/admin/inscriptions", badgeKey: "inscriptions", allowedRoles: APPROVAL_ROLES },
      { label: "Établissements", href: "/admin/etablissements", allowedRoles: DIRECTORY_ROLES },
      { label: "Annuaire", href: "/home/annuaire?tab=users", allowedRoles: DIRECTORY_ROLES },
    ],
  },
  {
    key: "qualite",
    label: "Contrôle Qualité",
    href: "/admin/centre-qualite",
    iconName: "quality",
    badgeKey: "anomalies",
    allowedRoles: ADMIN_ROLES,
    matchPrefixes: ["/admin/centre-qualite", "/admin/files-attente"],
    subRoutes: [
      { label: "Centre Qualité", href: "/admin/centre-qualite", allowedRoles: ADMIN_ROLES },
      { label: "Anomalies", href: "/admin/files-attente?tab=anomalies", badgeKey: "anomalies", allowedRoles: ADMIN_ROLES },
      // The "Contrôle régional" entry pointed at ?tab=regional, which
      // /admin/centre-qualite never read — it rendered the same unscoped view.
      // Removed rather than re-pointed: a real regional view needs a `region`
      // filter on GET quality/summary and anomalies/registry, which the
      // backend does not accept yet (both are already territory-scoped by
      // territoryFromUser, so a REGIONAL_ADMIN cannot widen past its own
      // ressort). The entry returns with that backend change, as ?region=.
    ],
  },
  {
    key: "donnees",
    label: "Données",
    href: "/admin/diffusion",
    iconName: "data",
    allowedRoles: NATIONAL_ROLES,
    matchPrefixes: ["/admin/diffusion", "/admin/sectors"],
    subRoutes: [
      { label: "Gestion & Exports", href: "/admin/diffusion", allowedRoles: NATIONAL_ROLES },
      { label: "Jeux de données (Secteurs)", href: "/admin/sectors", allowedRoles: NATIONAL_ROLES },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    href: "/admin/utilisateurs",
    iconName: "settings",
    // Visible only if user role has at least one administrative permission
    allowedRoles: [...USER_ADMIN_ROLES, ...AUDIT_ROLES],
    matchPrefixes: ["/admin/parametres", "/admin/utilisateurs", "/admin/journal-audit"],
    subRoutes: [
      { label: "Utilisateurs & rôles", href: "/admin/utilisateurs", allowedRoles: USER_ADMIN_ROLES },
      { label: "Journal d'audit", href: "/admin/journal-audit", allowedRoles: AUDIT_ROLES },
      { label: "Paramètres", href: "/admin/parametres", allowedRoles: SETTINGS_ROLES },
    ],
  },
];

/**
 * Hubs indexed by `key`, the seam @/lib/nav-profiles uses to turn a role's
 * declared hub list into hubs. `key` is required on AdminHub, so every hub is
 * always reachable from a profile — there is no second identifier to keep in
 * step with it.
 */
export function hubsByKey(): Map<HubKey, AdminHub> {
  const byKey = new Map<HubKey, AdminHub>();
  for (const hub of ADMIN_HUBS) {
    byKey.set(hub.key, hub);
  }
  return byKey;
}

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
export function isRoleAllowed(allowedRoles: readonly UserRole[] | undefined, role: UserRole | undefined): boolean {
  if (!allowedRoles) return true;
  return !!role && (allowedRoles as readonly string[]).includes(role);
}

/**
 * Roles allowed on `pathname`: those of the longest matching route prefix,
 * or null when no gated route matches (no per-page gate).
 */
export function getAllowedRoles(pathname: string): readonly UserRole[] | null {
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
