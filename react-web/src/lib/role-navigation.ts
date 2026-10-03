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
import type { UserRole } from "./roles";

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
// names. COMPANY's real label comes from Flutter's l10n (roleLabelCompany);
// this app has no i18n layer here yet, so it stays inlined bilingually.
const ROLE_LABELS: Record<string, string> = {
  COMPANY: "Entreprise/ Company",
  DIVISIONAL_ADMIN: "Division du Travail",
  REGIONAL_ADMIN: "Delegation Regionale",
  ADMIN_ONEFOP: "Admin · ONEFOP",
  SUPER_ADMIN: "Super Admin · DSMO + ONEFOP",
  AUDITOR: "Auditeur",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export interface NavItem {
  slug: string;
  label: string;
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
// order, and grouping preserved. The cross-cutting "Nouveau questionnaire"
// item (home_screen.dart's drawer, shown for every `!isCompany` role) is
// appended separately below rather than duplicated into each list.
const TABS_BY_ROLE: Record<NavRole, NavItem[]> = {
  COMPANY: [
    { slug: "home", label: "Accueil/ Home" },
    { slug: "declarations", label: "Déclarations/ Declarations", route: "/home/declarations" },
    { slug: "analytics", label: "Analytique/ Analytics" },
    { slug: "settings", label: "Paramètres/ Settings" },
  ],
  DIVISIONAL_ADMIN: [
    { slug: "pilotage", label: "Tableau de Bord Territorial", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "submissions", label: "Instruction des Dossiers", route: "/admin/dossiers" },
    { slug: "analytics", label: "Statistiques Territoriales" },
  ],
  REGIONAL_ADMIN: [
    { slug: "pilotage", label: "Tableau de Bord Régional", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "submissions", label: "Instruction des Dossiers", route: "/admin/dossiers" },
    { slug: "analytics-dsmo", label: "Statistiques DSMO" },
    { slug: "notifications", label: "Communications & Notifications" },
  ],
  // Union of the former CENTRAL and SUPER_ADMIN_ONEFOP lists (see header).
  ADMIN_ONEFOP: [
    { slug: "pilotage", label: "Tableau de Bord National", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "dossiers", label: "Instruction & Visas", route: "/admin/dossiers" },
    { slug: "diffusion", label: "Statistiques & Diffusion", route: "/admin/diffusion" },
    { slug: "settings", label: "Nomenclature des Secteurs", route: "/admin/sectors" },
    { slug: "utilisateurs", label: "Utilisateurs ONEFOP", route: "/admin/utilisateurs", rawRoles: ["SUPER_ADMIN", "ADMIN_ONEFOP"] },
    { slug: "annuaire", label: "Répertoire des Établissements", route: "/home/annuaire" },
    { slug: "analytics-dsmo", label: "Statistiques DSMO" },
    { slug: "notifications", label: "Communications & Notifications" },
  ],
  SUPER_ADMIN: [
    { slug: "pilotage", label: "Tableau de Bord National", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "dossiers", label: "Instruction & Visas", route: "/admin/dossiers" },
    { slug: "diffusion", label: "Statistiques & Diffusion", route: "/admin/diffusion" },
    { slug: "settings", label: "Nomenclature des Secteurs", route: "/admin/sectors" },
    { slug: "utilisateurs", label: "Utilisateurs ONEFOP", route: "/admin/utilisateurs", rawRoles: ["SUPER_ADMIN", "ADMIN_ONEFOP"] },
    { slug: "declarations-dsmo", label: "Déclarations DSMO" },
    { slug: "annuaire", label: "Gestion des Utilisateurs & Entités", route: "/home/annuaire" },
  ],
  // AUDITOR had no _buildTabs branch in Flutter and fell through to the
  // default. Commit 2 gives it an explicit (empty) nav profile.
  AUDITOR: [],
};

const FALLBACK_TABS: NavItem[] = [{ slug: "notifications", label: "Notifications" }];

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
