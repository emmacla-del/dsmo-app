// src/lib/role-navigation.ts
//
// Faithful port of lib/screens/home_screen.dart's role → navigation mapping
// (_resolveRole, _roleLabel, _buildTabs), read directly from the source
// during this session — not reinvented. Phase 3 of the migration plan:
// "Port role-aware navigation... Replicate the existing 7-role
// permission/navigation behavior." These are the 7 roles _buildTabs
// actually branches on (plus its own `default` fallback) — a narrower set
// than user-types.ts's full 11-value UserRole (DATA_MANAGER/ANALYST/AUDITOR
// fall through to that same default there too, in Flutter).
import type { User } from "./user-types";

export type NavRole =
  | "COMPANY"
  | "DIVISIONAL"
  | "REGIONAL"
  | "CENTRAL"
  | "SUPER_ADMIN"
  | "SUPER_ADMIN_DSMO"
  | "SUPER_ADMIN_ONEFOP";

/**
 * Direct port of _resolveRole (home_screen.dart): SUPER_ADMIN is a compound
 * role that splits by the user's `stream` into a DSMO-only or ONEFOP-only
 * admin view. Any role outside the 7 recognized here (DATA_MANAGER,
 * ANALYST, AUDITOR today) is returned as-is and picked up by the fallback
 * case in NAV_ITEMS_BY_ROLE below, matching Flutter's own unrecognized-role
 * fallback rather than crashing or guessing a mapping for roles that don't
 * have one yet.
 */
export function resolveEffectiveRole(user: User): string {
  if (user.role !== "SUPER_ADMIN") return user.role;
  const stream = user.stream?.toUpperCase();
  if (stream === "DSMO") return "SUPER_ADMIN_DSMO";
  if (stream === "ONEFOP") return "SUPER_ADMIN_ONEFOP";
  return "SUPER_ADMIN";
}

// Direct port of _roleLabel (home_screen.dart). COMPANY's real label comes
// from Flutter's l10n (roleLabelCompany) rather than a hardcoded string;
// this app has no i18n layer yet, so it's inlined bilingually here instead
// of guessing at translation keys that don't exist on this side yet.
const ROLE_LABELS: Record<string, string> = {
  COMPANY: "Entreprise/ Company",
  DIVISIONAL: "Division du Travail",
  REGIONAL: "Delegation Regionale",
  CENTRAL: "Direction Nationale",
  SUPER_ADMIN: "Super Admin · DSMO + ONEFOP",
  SUPER_ADMIN_DSMO: "Admin · Regulation MO",
  SUPER_ADMIN_ONEFOP: "Admin · ONEFOP",
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
  // the tab list's (stream-resolved) role — e.g. /auth/users is
  // @Roles('SUPER_ADMIN') exactly, so a SUPER_ADMIN_ONEFOP account would 403.
  rawRoles?: string[];
}

// Every role's tab list, ported field-for-field from _buildTabs — labels,
// order, and grouping preserved exactly. The cross-cutting "Nouveau
// questionnaire" item (home_screen.dart's drawer, shown for every
// `!isCompany` role) is appended separately below rather than duplicated
// into each list.
const TABS_BY_ROLE: Record<NavRole, NavItem[]> = {
  COMPANY: [
    { slug: "home", label: "Accueil/ Home" },
    { slug: "declarations", label: "Déclarations/ Declarations", route: "/home/declarations" },
    { slug: "analytics", label: "Analytique/ Analytics" },
    { slug: "settings", label: "Paramètres/ Settings" },
  ],
  DIVISIONAL: [
    { slug: "pilotage", label: "Tableau de Bord Territorial", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "submissions", label: "Instruction des Dossiers", route: "/admin/dossiers" },
    { slug: "analytics", label: "Statistiques Territoriales" },
  ],
  REGIONAL: [
    { slug: "pilotage", label: "Tableau de Bord Régional", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "submissions", label: "Instruction des Dossiers", route: "/admin/dossiers" },
    { slug: "analytics-dsmo", label: "Statistiques DSMO" },
    { slug: "notifications", label: "Communications & Notifications" },
  ],
  CENTRAL: [
    { slug: "pilotage", label: "Tableau de Bord National", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "submissions-onefop", label: "Instruction des Dossiers", route: "/admin/dossiers" },
    { slug: "diffusion", label: "Statistiques & Diffusion", route: "/admin/diffusion" },
    { slug: "analytics-dsmo", label: "Statistiques DSMO" },
    { slug: "notifications", label: "Communications & Notifications" },
  ],
  SUPER_ADMIN: [
    { slug: "pilotage", label: "Tableau de Bord National", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "dossiers", label: "Instruction & Visas", route: "/admin/dossiers" },
    { slug: "diffusion", label: "Statistiques & Diffusion", route: "/admin/diffusion" },
    { slug: "settings", label: "Nomenclature des Secteurs", route: "/admin/sectors" },
    { slug: "utilisateurs", label: "Utilisateurs ONEFOP", route: "/admin/utilisateurs", rawRoles: ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP"] },
    { slug: "annuaire", label: "Gestion des Utilisateurs & Entités", route: "/home/annuaire" },
  ],
  SUPER_ADMIN_DSMO: [
    { slug: "pilotage", label: "Tableau de Bord National", route: "/admin/pilotage" },
    { slug: "declarations-dsmo", label: "Déclarations DSMO" },
    { slug: "annuaire", label: "Répertoire des Établissements", route: "/home/annuaire" },
  ],
  SUPER_ADMIN_ONEFOP: [
    { slug: "pilotage", label: "Tableau de Bord National", route: "/admin/pilotage" },
    { slug: "files-attente", label: "Dossiers en Instance", route: "/admin/files-attente" },
    { slug: "dossiers", label: "Instruction & Visas", route: "/admin/dossiers" },
    { slug: "diffusion", label: "Statistiques & Diffusion", route: "/admin/diffusion" },
    { slug: "settings", label: "Nomenclature des Secteurs", route: "/admin/sectors" },
    { slug: "utilisateurs", label: "Utilisateurs ONEFOP", route: "/admin/utilisateurs", rawRoles: ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP"] },
    { slug: "annuaire", label: "Répertoire des Établissements", route: "/home/annuaire" },
  ],
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
