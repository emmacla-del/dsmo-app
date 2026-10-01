import type { UserRole } from "@/lib/user-types";

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

// ── Role Groups ──────────────────────────────────────────────────────────────

export const SUPER_ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SUPER_ADMIN_DSMO",
  "SUPER_ADMIN_ONEFOP",
];

export const DOSSIER_PROCESSORS: UserRole[] = [
  ...SUPER_ADMIN_ROLES,
  "CENTRAL",
  "REGIONAL",
  "DIVISIONAL",
];

export const CAMPAIGN_MANAGERS: UserRole[] = [
  ...SUPER_ADMIN_ROLES,
  "CENTRAL",
  "CAMPAIGN_MANAGER",
  "REGIONAL",
  "DATA_MANAGER",
  "ANALYST",
];

export const QUESTIONNAIRE_MANAGERS: UserRole[] = [
  ...SUPER_ADMIN_ROLES,
  "CENTRAL",
  "CAMPAIGN_MANAGER",
  "DATA_MANAGER",
  "REGIONAL",
  "DIVISIONAL",
];

export const DATA_ROLES: UserRole[] = [
  ...SUPER_ADMIN_ROLES,
  "CENTRAL",
  "DATA_MANAGER",
  "ANALYST",
  "REGIONAL",
  "AUDITOR",
];

export const DIRECTORY_ROLES: UserRole[] = [
  ...SUPER_ADMIN_ROLES,
  "CENTRAL",
  "REGIONAL",
  "DIVISIONAL",
  "DATA_MANAGER",
  "ANALYST",
  "AUDITOR",
];

// Administrative roles
export const SETTINGS_ROLES: UserRole[] = [...SUPER_ADMIN_ROLES];
export const USER_ADMIN_ROLES: UserRole[] = [...SUPER_ADMIN_ROLES];
export const AUDIT_LOG_ROLES: UserRole[] = [...SUPER_ADMIN_ROLES, "AUDITOR"];

// ── Primary 6 Hubs Definition ────────────────────────────────────────────────

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
      { label: "Dossiers en instance", href: "/admin/files-attente", badgeKey: "pending", allowedRoles: [...DOSSIER_PROCESSORS, "AUDITOR"] },
      { label: "Activité & alertes", href: "/admin/pilotage#activity" },
    ],
  },
  {
    key: "collecte",
    label: "Collecte",
    href: "/admin/campagnes",
    iconName: "collecte",
    allowedRoles: [...CAMPAIGN_MANAGERS, ...QUESTIONNAIRE_MANAGERS],
    matchPrefixes: ["/admin/campagnes", "/admin/questionnaires"],
    subRoutes: [
      { label: "Campagnes", href: "/admin/campagnes", allowedRoles: CAMPAIGN_MANAGERS },
      { label: "Questionnaires", href: "/admin/questionnaires", allowedRoles: QUESTIONNAIRE_MANAGERS },
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
      { label: "Inscriptions", href: "/admin/inscriptions", badgeKey: "inscriptions", allowedRoles: DOSSIER_PROCESSORS },
      { label: "Établissements", href: "/admin/etablissements", allowedRoles: DIRECTORY_ROLES },
      { label: "Annuaire déclarants", href: "/home/annuaire?tab=users", allowedRoles: DIRECTORY_ROLES },
    ],
  },
  {
    key: "qualite",
    label: "Contrôle Qualité",
    href: "/admin/dossiers",
    iconName: "quality",
    badgeKey: "anomalies",
    allowedRoles: [...DOSSIER_PROCESSORS, "DATA_MANAGER", "AUDITOR"],
    matchPrefixes: ["/admin/dossiers"],
    subRoutes: [
      { label: "Visas & décisions", href: "/admin/dossiers", allowedRoles: DOSSIER_PROCESSORS },
      { label: "Anomalies", href: "/admin/files-attente?tab=anomalies", badgeKey: "anomalies", allowedRoles: [...DOSSIER_PROCESSORS, "DATA_MANAGER", "AUDITOR"] },
      { label: "Contrôle régional", href: "/admin/dossiers?status=PENDING_REVIEW", allowedRoles: DOSSIER_PROCESSORS },
    ],
  },
  {
    key: "donnees",
    label: "Données",
    href: "/admin/centre-qualite",
    iconName: "data",
    allowedRoles: DATA_ROLES,
    matchPrefixes: ["/admin/centre-qualite", "/admin/sectors", "/admin/diffusion"],
    subRoutes: [
      { label: "Centre Qualité", href: "/admin/centre-qualite", allowedRoles: DATA_ROLES },
      { label: "Jeux de données (Secteurs)", href: "/admin/sectors" },
      { label: "Gestion & Exports", href: "/admin/diffusion", allowedRoles: DATA_ROLES },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    href: "/admin/parametres",
    iconName: "settings",
    // Visible only if user role has at least one administrative permission
    allowedRoles: [...SETTINGS_ROLES, ...USER_ADMIN_ROLES, ...AUDIT_LOG_ROLES],
    matchPrefixes: ["/admin/parametres", "/admin/utilisateurs", "/admin/journal-audit"],
    subRoutes: [
      { label: "Paramètres généraux", href: "/admin/parametres", allowedRoles: SETTINGS_ROLES },
      { label: "Utilisateurs ONEFOP", href: "/admin/utilisateurs", allowedRoles: USER_ADMIN_ROLES },
      { label: "Journal d'audit", href: "/admin/journal-audit", allowedRoles: AUDIT_LOG_ROLES },
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
 * Returns the visible hubs for a given role, tailoring the primary landing href
 * to the first allowed sub-route for that role.
 */
export function getVisibleHubs(role: UserRole | undefined): AdminHub[] {
  return ADMIN_HUBS.map((hub) => {
    // If hub has role gates and role doesn't match, hide
    if (!isRoleAllowed(hub.allowedRoles, role)) return null;

    // Filter sub-routes allowed for this role
    const allowedSubRoutes = hub.subRoutes.filter((sub) => isRoleAllowed(sub.allowedRoles, role));
    if (allowedSubRoutes.length === 0) return null;

    // Set landing URL to the first sub-route the user actually has access to
    const effectiveHref = allowedSubRoutes[0].href;

    return {
      ...hub,
      href: effectiveHref,
      subRoutes: allowedSubRoutes,
    };
  }).filter(Boolean) as AdminHub[];
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
