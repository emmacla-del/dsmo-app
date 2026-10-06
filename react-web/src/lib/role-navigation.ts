// src/lib/role-navigation.ts
//
// Role → navigation mapping for the /home shell. Originally a faithful port
// of lib/screens/home_screen.dart (_resolveRole, _roleLabel, _buildTabs).
//
// role_model_refactor changed two things here:
//
//  1. The stream-based role synthesis is gone. Flutter's _resolveRole split
//     SUPER_ADMIN into SUPER_ADMIN_DSMO / SUPER_ADMIN_ONEFOP by the
//     account's `stream`. Those are no longer roles, and mapping a real
//     SUPER_ADMIN onto ADMIN_ONEFOP would have demoted it. SUPER_ADMIN is
//     now simply SUPER_ADMIN. If navigation should still vary by stream,
//     that is a view concept and belongs in the nav profiles, not in the
//     role model. `User.stream` is left on the type for that purpose.
//
//  2. ADMIN_ONEFOP absorbed both CENTRAL and the former
//     SUPER_ADMIN_ONEFOP, which had different tab lists. Its list below is
//     the union of the two, so no destination that was reachable before
//     became unreachable. Ordering follows the former SUPER_ADMIN_ONEFOP
//     list, with CENTRAL's two extra entries appended.
import type { User } from "./user-types";
import { USER_ADMIN_ROLES, type UserRole } from "./roles";

export type NavRole = UserRole;

/**
 * The account's role, unmodified. Kept as a function (rather than inlining
 * `user.role` at the five call sites) so the nav layer keeps one seam for
 * deriving an effective view, which commit 2's nav profiles build on.
 */
export function resolveEffectiveRole(user: User): string {
  return user.role;
}

// Labels from _roleLabel (home_screen.dart), carried over to the new role
// names. They are message keys under homeNav.role; each used to be one
// "Français/ English" string, from before this app had an i18n layer.
const ROLE_LABEL_KEYS = new Set(["COMPANY", "DIVISIONAL_ADMIN", "REGIONAL_ADMIN", "ADMIN_ONEFOP", "SUPER_ADMIN", "AUDITOR"]);

/** Message key for a role's /home badge, or null for an unknown role (shown as stored). */
export function roleLabelKey(role: string): string | null {
  return ROLE_LABEL_KEYS.has(role) ? `homeNav.role.${role}` : null;
}

export interface NavItem {
  slug: string;
  /** Message key of the item's label (homeNav.item.*). */
  labelKey: string;
  // Set only for the one destination that actually exists in React today
  // (the ONEFOP declaration entry point built earlier this migration,
  // /onefop/preview). Every other item is a real, faithfully-labeled
  // destination from home_screen.dart that has no React implementation
  // yet — rendered as an honest "not yet migrated" placeholder
  // (src/app/home/[slug]/page.tsx) rather than a fabricated one, per the
  // plan's Phase 6 "retire per module" model: each destination migrates
  // independently, not all-or-nothing.
  route?: string;
  // Raw account roles the destination's backend accepts, when narrower than
  // the tab list's role — e.g. /admin/utilisateurs is USER_ADMIN_ROLES, so a
  // role outside that set would 403.
  rawRoles?: string[];
}

// Every role's tab list, ported field-for-field from _buildTabs — labels,
// order, and grouping preserved. One exception: each administrative list had a
// "Dossiers en Instance" item pointing at /admin/files-attente, whose three
// queues were redistributed (blocking anomalies to /admin/centre-qualite,
// visas and corrections to /admin/dossiers as in-page tabs) and whose page was
// deleted. The item is gone rather than re-pointed, because every one of those
// lists already carries /admin/dossiers on the next line. The cross-cutting "Nouveau questionnaire"
// item (home_screen.dart's drawer, shown for every `!isCompany` role) is
// appended separately below rather than duplicated into each list.
const TABS_BY_ROLE: Record<NavRole, NavItem[]> = {
  COMPANY: [
    { slug: "home", labelKey: "homeNav.item.home" },
    { slug: "declarations", labelKey: "homeNav.item.declarations", route: "/home/declarations" },
    { slug: "analytics", labelKey: "homeNav.item.analytics" },
    { slug: "settings", labelKey: "homeNav.item.settings" },
  ],
  DIVISIONAL_ADMIN: [
    { slug: "pilotage", labelKey: "homeNav.item.territorialDashboard", route: "/admin/pilotage" },
    { slug: "submissions", labelKey: "homeNav.item.fileReview", route: "/admin/dossiers" },
    // No "Statistiques" entry: the React app has no analytics screen, and the
    // entry only led to the not-yet-migrated placeholder.
  ],
  REGIONAL_ADMIN: [
    { slug: "pilotage", labelKey: "homeNav.item.regionalDashboard", route: "/admin/pilotage" },
    { slug: "submissions", labelKey: "homeNav.item.fileReview", route: "/admin/dossiers" },
    // No "Statistiques DSMO" entry, for the same reason as DIVISIONAL_ADMIN.
    // REGIONAL_ADMIN will be able to send notifications when the ONEFOP
    // notification composer is implemented. The slug is intentionally omitted
    // until that component exists — see the deleted DSMO SendNotificationForm
    // in git history for the shape it should take.
  ],
  // Union of the former CENTRAL and SUPER_ADMIN_ONEFOP lists (see header).
  ADMIN_ONEFOP: [
    { slug: "pilotage", labelKey: "homeNav.item.nationalDashboard", route: "/admin/pilotage" },
    { slug: "dossiers", labelKey: "homeNav.item.reviewEndorsement", route: "/admin/dossiers" },
    { slug: "diffusion", labelKey: "homeNav.item.statisticsDissemination", route: "/admin/diffusion" },
    { slug: "settings", labelKey: "homeNav.item.sectorClassification", route: "/admin/sectors" },
    { slug: "utilisateurs", labelKey: "homeNav.item.onefopUsers", route: "/admin/utilisateurs", rawRoles: [...USER_ADMIN_ROLES] },
    { slug: "annuaire", labelKey: "homeNav.item.establishmentRegister", route: "/admin/annuaire" },
    { slug: "analytics-dsmo", labelKey: "homeNav.item.dsmoStatistics" },
  ],
  SUPER_ADMIN: [
    { slug: "pilotage", labelKey: "homeNav.item.nationalDashboard", route: "/admin/pilotage" },
    { slug: "dossiers", labelKey: "homeNav.item.reviewEndorsement", route: "/admin/dossiers" },
    { slug: "diffusion", labelKey: "homeNav.item.statisticsDissemination", route: "/admin/diffusion" },
    { slug: "settings", labelKey: "homeNav.item.sectorClassification", route: "/admin/sectors" },
    { slug: "utilisateurs", labelKey: "homeNav.item.onefopUsers", route: "/admin/utilisateurs", rawRoles: [...USER_ADMIN_ROLES] },
    { slug: "annuaire", labelKey: "homeNav.item.userEntityManagement", route: "/admin/annuaire" },
  ],
  // AUDITOR had no _buildTabs branch in Flutter and fell through to the
  // default. Commit 2 gives it an explicit (empty) nav profile.
  AUDITOR: [],
};

const FALLBACK_TABS: NavItem[] = [];

/**
 * Full nav item list for a role.
 * Only COMPANY roles have declaration filing tasks. Administrative roles have
 * strictly supervision, instruction, arbitration, and statistical diffusion tools.
 */
export function navItemsForRole(role: string): NavItem[] {
  const base = TABS_BY_ROLE[role as NavRole];
  if (!base) return FALLBACK_TABS;
  return base;
}
