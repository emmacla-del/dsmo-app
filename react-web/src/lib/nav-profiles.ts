// src/lib/nav-profiles.ts
//
// Per-role navigation profiles for the admin console sidebar.
//
// ── The profile model, and what it replaces ─────────────────────────────────
//
// Until this commit the sidebar rendered getVisibleHubs(role) (since
// removed from _routes.ts): one shared
// ADMIN_HUBS list, filtered by each hub's `allowedRoles`. That is a
// *subtractive* model — a hub is shown unless some role gate removes it — and
// it has two failure modes the admin-console audit found in practice:
//
//  1. A hub appears for a role whose pages all 403, because the hub's own
//     `allowedRoles` was wider than its sub-routes' (ADMIN_ONEFOP and AUDITOR
//     both hit this). The role sees a destination it cannot open.
//  2. The nav any given role gets is an emergent property of ~15 scattered
//     `allowedRoles` arrays. Nobody can read one place and say what a
//     DIVISIONAL_ADMIN's sidebar contains, so nobody notices when it drifts.
//
// A profile is *additive* instead: each role names the hubs it gets, in the
// order it gets them. Reading NAV_PROFILES below tells you a role's whole
// sidebar. Adding a hub to ADMIN_HUBS shows it to nobody until a profile asks
// for it, which is the safe default — the old model's default was to show it
// to everyone not explicitly excluded.
//
// ── What profiles do *not* decide ───────────────────────────────────────────
//
// Profiles choose which hubs appear. They do not grant access to anything:
//
//  * The landing href and the secondary nav still come from each hub's
//    sub-routes and their `allowedRoles` (navHubsFor below, and
//    AdminPageHeader). That is what keeps failure mode 1 fixed: a hub lands
//    on the first sub-route the role can actually open, and a hub with no
//    openable sub-route is dropped even if a profile listed it.
//  * Authorization is server-side — RolesGuard plus the territory helpers.
//    RequireAdminRole/getAllowedRoles(pathname) gates the route itself. A
//    profile that is wider than the backend shows a hub whose page the API
//    still refuses; it can never be the reverse.
//
// Hub-level visibility is now the profile's business alone, so navHubsFor
// deliberately does not re-check `hub.allowedRoles` — consulting both would
// leave two sources of truth for the one question this file exists to answer.
// Nothing reads `hub.allowedRoles` at runtime any more (AdminPageHeader and
// the sidebar filter sub-routes, not hubs); it remains as documentation of
// the hub's widest audience.

import { hubsByKey, isRoleAllowed, type AdminHub, type HubKey } from "@/app/admin/_routes";
import type { UserRole } from "@/lib/roles";

/**
 * One role's sidebar: the hubs it gets, in the order they are rendered.
 *
 * Hubs are named by `key` (HubKey), the identifier ADMIN_HUBS already carries.
 * An earlier draft added a parallel `hubId` for this; it was reverted, because
 * two names for the same six hubs is a drift hazard and `key` was already
 * stable, short, and neither an index nor a label.
 */
export interface NavProfile {
  hubs: readonly HubKey[];
}

/**
 * Every role's curated hub list.
 *
 * Typed as a total Record over UserRole, so adding a role to the Prisma enum
 * is a type error here rather than a role that silently gets no navigation.
 * Hub names are HubKey, so a typo is a type error rather than a hub that
 * silently disappears from that role's sidebar.
 *
 * The membership principle: a role gets a hub when it can open at least one
 * sub-route inside it. Under that rule the lists below are the full closure
 * of what each role can reach — "donnees" is absent from the territorial
 * profiles because both its sub-routes are NATIONAL_ROLES, and
 * "administration" is absent from both territorial profiles because none of
 * its sub-routes (USER_ADMIN_ROLES, AUDIT_ROLES, SETTINGS_ROLES) include
 * them. /admin/equipe (MONITORING_ROLES), which once gave REGIONAL_ADMIN
 * that hub, now sits under "supervision".
 *
 * AUDITOR is the one deliberate exception. It can open the one ungated
 * sub-route under "supervision" (/admin/pilotage has no allowedRoles), so the
 * principle would give it that hub too. Its nav is held
 * to the audit journal alone until the role is designed properly — see the
 * note on its entry below.
 */
export const NAV_PROFILES: Record<UserRole, NavProfile> = {
  SUPER_ADMIN: {
    hubs: ["supervision", "collecte", "declarants", "qualite", "donnees", "administration"],
  },
  // Same six hubs as SUPER_ADMIN, and intentionally written out rather than
  // aliased to it: the two diverge inside "administration", where ADMIN_ONEFOP
  // sees only /admin/utilisateurs (USER_ADMIN_ROLES) while the journal
  // (AUDIT_ROLES) and settings (SETTINGS_ROLES) stay hidden by their own
  // sub-route gates. Keeping the lists separate means a later change to one
  // role's nav cannot silently move the other's.
  ADMIN_ONEFOP: {
    hubs: ["supervision", "collecte", "declarants", "qualite", "donnees", "administration"],
  },
  // Territorial profiles. Same hubs; they differ inside them. REGIONAL_ADMIN
  // also sees /admin/equipe under "supervision" (MONITORING_ROLES), and
  // "collecte" resolves to /admin/campagnes for REGIONAL_ADMIN (it is in
  // CAMPAIGN_ROLES) but to /admin/cibles for DIVISIONAL_ADMIN (it is not).
  // Each hub's own territory scoping is applied server-side.
  REGIONAL_ADMIN: {
    hubs: ["supervision", "collecte", "declarants", "qualite"],
  },
  DIVISIONAL_ADMIN: {
    hubs: ["supervision", "collecte", "declarants", "qualite"],
  },
  // Deferred, deliberately minimal: "administration" resolves to
  // /admin/journal-audit, the one page in AUDIT_ROLES. The hub therefore reads
  // "Administration" with a settings gear for a read-only role, which is
  // wrong; a dedicated audit hub with its own label and icon is the fix, and
  // is left for the commit that designs this role.
  AUDITOR: {
    hubs: ["administration"],
  },
  // Read-only central staff: the national dashboard and the dossiers
  // ("supervision"), and the establishment directory ("declarants", which
  // resolves to /admin/etablissements -- the registration queue is
  // APPROVAL_ROLES). No collecte, qualite, donnees or administration: those
  // hubs are about acting, and every action is refused to the role.
  CENTRAL_AGENT: {
    hubs: ["supervision", "declarants"],
  },
  // Not a console role: the /admin layout guard (ADMIN_ROLES) turns COMPANY
  // away before any sidebar renders. Present so the Record stays total.
  COMPANY: {
    hubs: [],
  },
};

/** The profile for an unknown or absent role: no navigation at all. */
export const EMPTY_NAV_PROFILE: NavProfile = { hubs: [] };

/**
 * A role's profile, or EMPTY_NAV_PROFILE when the role is absent or is not a
 * value of UserRole. `role` is widened because JWT payloads are untyped, and
 * an unrecognised role must fail closed rather than fall through to a default
 * list.
 */
export function resolveNavProfile(role: string | null | undefined): NavProfile {
  if (!role) return EMPTY_NAV_PROFILE;
  return NAV_PROFILES[role as UserRole] ?? EMPTY_NAV_PROFILE;
}

/**
 * The hubs to render for `role`, in profile order, each with `href` pointing
 * at the first sub-route that role may actually open.
 *
 * A listed hub is dropped when it has no openable sub-route. That is a profile
 * bug rather than a runtime condition, and dropping fails closed: it costs the
 * role one nav entry, where rendering would hand it a 403.
 */
export function navHubsFor(role: string | null | undefined): AdminHub[] {
  const byKey = hubsByKey();
  const typedRole = (role ?? undefined) as UserRole | undefined;

  return resolveNavProfile(role).hubs.flatMap((key) => {
    const hub = byKey.get(key);
    if (!hub) return [];

    const openable = hub.subRoutes.filter((sub) => !sub.hidden && isRoleAllowed(sub.allowedRoles, typedRole));
    if (openable.length === 0) return [];

    return [{ ...hub, href: openable[0].href, subRoutes: openable }];
  });
}
