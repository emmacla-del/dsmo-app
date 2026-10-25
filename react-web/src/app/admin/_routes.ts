import type { UserRole } from "@/lib/roles";
import {
  ALL_ROLES,
  APPROVAL_ROLES,
  AUDIT_ROLES,
  CAMPAIGN_ROLES,
  DIRECTORY_READ_ROLES,
  DIRECTORY_ROLES,
  MONITORING_ROLES,
  NATIONAL_ROLES,
  PILOTAGE_READ_ROLES,
  SURVEY_READ_ROLES,
  SURVEY_ROLES,
  SETTINGS_ROLES,
  USER_ADMIN_ROLES,
} from "@/lib/roles";

// Admin console role-based navigation & permissions single source of truth.
// Maps the primary hubs and their sub-routes to allowed user roles, mirroring
// backend NestJS controller @Roles annotations.
//
// allowedRoles undefined = accessible to all console staff roles.

export type HubKey =
  | "supervision"
  | "equipe"
  | "inscriptions"
  | "teledeclarations"
  | "collecte"
  | "donnees"
  | "administration";

export interface AdminSubRoute {
  /** French label; the fallback when `labelKey` is absent. */
  label: string;
  /**
   * Message key under `adminNav.routes` that renders this entry in the
   * console locale. Optional so ad-hoc sub-routes (tests, page-local tabs)
   * can still pass a plain label.
   */
  labelKey?: string;
  href: string;
  badgeKey?: "pending" | "anomalies";
  allowedRoles?: readonly UserRole[];
  /**
   * Gated but never rendered as a nav entry. A detail page reached from a list
   * needs `allowedRoles` so getAllowedRoles() can gate it, but has no place in
   * the sidebar or the sub-navigation tabs. Consumers that render sub-routes
   * (navHubsFor, AdminPageHeader) filter these out.
   */
  hidden?: boolean;
}

export interface AdminHub {
  key: HubKey;
  /** French label. Rendered through `adminNav.hubs.<key>` in the console locale. */
  label: string;
  href: string;
  iconName: "dashboard" | "team" | "collecte" | "declarants" | "quality" | "data" | "settings";
  matchPrefixes: string[];
  badgeKey?: "pending" | "anomalies";
  allowedRoles?: readonly UserRole[];
  subRoutes: AdminSubRoute[];
}

// ── Primary 6 Hubs Definition ────────────────────────────────────────────────

export const ADMIN_HUBS: AdminHub[] = [
  // Regrouped by the object the work is about (2026-10-23). A declaration used
  // to cross four hubs -- its dashboard and visa queue under "supervision",
  // its returns under "collecte", its anomalies under "qualite", its export
  // under "donnees" -- so a reviewer's loop (queue, anomaly, back to queue)
  // spanned two rail rows. Now "supervision" holds only the screens that
  // decide nothing, and each decision queue sits with the object it decides
  // on. The dashboard is one overview destination; territorial team activity
  // has its own role-gated management destination.
  {
    key: "supervision",
    label: "Tableau de bord",
    href: "/admin/pilotage",
    iconName: "dashboard",
    allowedRoles: [...PILOTAGE_READ_ROLES, ...DIRECTORY_READ_ROLES],
    matchPrefixes: ["/admin/pilotage"],
    subRoutes: [
      {
        label: "Tableau de bord",
        labelKey: "pilotage",
        href: "/admin/pilotage",
        allowedRoles: [...PILOTAGE_READ_ROLES, ...DIRECTORY_READ_ROLES],
      },
    ],
  },
  {
    key: "equipe",
    label: "Équipe territoriale",
    href: "/admin/equipe",
    iconName: "team",
    allowedRoles: MONITORING_ROLES,
    matchPrefixes: ["/admin/equipe"],
    subRoutes: [
      { label: "Équipe territoriale", labelKey: "equipe", href: "/admin/equipe", allowedRoles: MONITORING_ROLES },
    ],
  },
  {
    key: "inscriptions",
    label: "Inscriptions",
    href: "/admin/inscriptions",
    iconName: "declarants",
    allowedRoles: DIRECTORY_READ_ROLES,
    matchPrefixes: ["/admin/inscriptions", "/admin/etablissements", "/admin/etablissement-detail"],
    subRoutes: [
      { label: "Examen des inscriptions", labelKey: "inscriptions", href: "/admin/inscriptions", allowedRoles: APPROVAL_ROLES },
      // The register is what an approved registration becomes, so it sits in
      // the same hub instead of the one-page "declarants" hub it had.
      { label: "Registre des établissements", labelKey: "etablissements", href: "/admin/etablissements", allowedRoles: DIRECTORY_READ_ROLES },
      // Admin-assisted registration (Phase 2 of the territorial admin
      // monitoring plan). `hidden` keeps it out of the sidebar and the tab
      // row: it is a form, not a destination, and /admin/inscriptions' own
      // "Nouvelle inscription" button is the way in. The entry stays because
      // its path nests under /admin/inscriptions and getAllowedRoles() takes
      // the longest matching prefix, so this entry -- not the queue's -- gates
      // it.
      { label: "Nouvelle inscription", labelKey: "nouvelleInscription", href: "/admin/inscriptions/nouvelle", allowedRoles: DIRECTORY_ROLES, hidden: true },
      // Detail page reached from the register. Listed so getAllowedRoles() has
      // roles to gate it with -- unlisted, RequireAdminRole found no match and
      // let any staff role through, AUDITOR included.
      { label: "Détail établissement", labelKey: "etablissementDetail", href: "/admin/etablissement-detail", allowedRoles: DIRECTORY_READ_ROLES, hidden: true },
    ],
  },
  {
    key: "teledeclarations",
    label: "Télédéclarations",
    href: "/admin/dossiers",
    iconName: "quality",
    badgeKey: "anomalies",
    allowedRoles: SURVEY_READ_ROLES,
    matchPrefixes: ["/admin/dossiers", "/admin/centre-qualite"],
    subRoutes: [
      { label: "Examen des télédéclarations", labelKey: "dossiers", href: "/admin/dossiers", badgeKey: "pending", allowedRoles: SURVEY_READ_ROLES },
      // Moved here from the former "qualite" hub: an anomaly is a reason to
      // send a file back, so it belongs beside the queue that sends it.
      // Consequence to know: CENTRAL_AGENT's profile hid that hub, while
      // /admin/centre-qualite (ADMIN_ROLES) has always admitted the role, so
      // the entry now shows for it. Narrowing the route is an RBAC decision,
      // not a navigation one, and is not taken here.
      { label: "Centre qualité des données", labelKey: "centreQualite", href: "/admin/centre-qualite", allowedRoles: SURVEY_ROLES },
      // The "Anomalies" entry pointed at /admin/files-attente?tab=anomalies.
      // That page rendered the same blocking-anomaly registry and the same
      // resolution dialog /admin/centre-qualite already carries, so it was
      // deleted rather than re-pointed: two entries for one table is what the
      // hub had, not two destinations.
      // The "Contrôle régional" entry pointed at ?tab=regional, which
      // /admin/centre-qualite never read -- it rendered the same unscoped view.
      // Removed rather than re-pointed: a real regional view needs a `region`
      // filter on GET quality/summary and anomalies/registry, which the
      // backend does not accept yet (both are already territory-scoped by
      // territoryFromUser, so a REGIONAL_ADMIN cannot widen past its own
      // ressort). The entry returns with that backend change, as ?region=.
    ],
  },
  {
    key: "collecte",
    label: "Gestion des campagnes",
    href: "/admin/campagnes",
    iconName: "collecte",
    allowedRoles: SURVEY_ROLES,
    matchPrefixes: ["/admin/campagnes", "/admin/cibles", "/admin/questionnaires"],
    subRoutes: [
      { label: "Campagnes", labelKey: "campagnes", href: "/admin/campagnes", allowedRoles: CAMPAIGN_ROLES },
      // Quotas are set per campaign and returns are measured against them, so
      // they sit next to the campaign list. The returns and follow-up views of
      // this page belong to the declaration workflow, but all three views
      // share one campaign picker, so the page stays whole and
      // "teledeclarations" links to it rather than splitting it.
      { label: "Quotas et retours de campagne", labelKey: "cibles", href: "/admin/cibles", allowedRoles: SURVEY_ROLES },
      { label: "Formulaires d’enquête", labelKey: "questionnaires", href: "/admin/questionnaires", allowedRoles: SURVEY_ROLES },
    ],
  },
  {
    key: "donnees",
    label: "Données et exports",
    href: "/admin/diffusion",
    iconName: "data",
    allowedRoles: NATIONAL_ROLES,
    matchPrefixes: ["/admin/diffusion", "/admin/sectors"],
    subRoutes: [
      { label: "Exports de données", labelKey: "diffusion", href: "/admin/diffusion", allowedRoles: NATIONAL_ROLES },
      { label: "Référentiels", labelKey: "sectors", href: "/admin/sectors", allowedRoles: NATIONAL_ROLES },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    href: "/admin/utilisateurs",
    iconName: "settings",
    // Visible only if user role has at least one administrative permission
    allowedRoles: [...USER_ADMIN_ROLES, ...AUDIT_ROLES, ...SETTINGS_ROLES],
    matchPrefixes: ["/admin/parametres", "/admin/utilisateurs", "/admin/annuaire", "/admin/journal-audit"],
    subRoutes: [
      { label: "Utilisateurs & rôles", labelKey: "utilisateurs", href: "/admin/utilisateurs", allowedRoles: USER_ADMIN_ROLES },
      // Formerly /home/annuaire under Déclarants, outside the console shell.
      // Opens on the accounts list (?tab=users), as the former entry did; the
      // page itself defaults to Entités, which is all ADMIN_ONEFOP is shown.
      { label: "Annuaire", labelKey: "annuaire", href: "/admin/annuaire?tab=users", allowedRoles: USER_ADMIN_ROLES },
      { label: "Journal d'audit", labelKey: "journalAudit", href: "/admin/journal-audit", allowedRoles: AUDIT_ROLES },
      { label: "Paramètres", labelKey: "parametres", href: "/admin/parametres", allowedRoles: SETTINGS_ROLES },
      // The caller's own notification inbox, reached from the header bell.
      // `hidden` keeps it out of the sidebar and the tab row -- it is not a
      // destination inside this hub. It is listed only so
      // getAllowedRoles("/admin/notifications") returns a list instead of
      // null: the server scopes every notification route to req.user.id, so
      // every role may read its own inbox (ALL_ROLES), but an unrecognised
      // role string now fails closed at RequireAdminRole rather than falling
      // through an absent gate.
      { label: "Notifications", labelKey: "notifications", href: "/admin/notifications", allowedRoles: ALL_ROLES, hidden: true },
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
    const params = new URLSearchParams(subQuery);
    let allMatch = !!searchParams;
    params.forEach((val, key) => {
      if (searchParams?.get(key) !== val) allMatch = false;
    });
    if (allMatch) return true;
    // A query only tells apart sibling entries that share this path. With no
    // such sibling, the query is just where the link lands (Annuaire's
    // ?tab=users), and the entry stays current on the page's other views.
    if (!allHubSubRoutes) return false;
    return !allHubSubRoutes.some(
      (other) => other.href !== subHref && other.href.split("?")[0].split("#")[0] === cleanPath,
    );
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
