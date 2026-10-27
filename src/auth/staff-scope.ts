import { ForbiddenException } from '@nestjs/common';
import { Territory, assertTerritorialAuthority } from './territory';

/**
 * Which staff accounts an administrator may see and manage through the
 * /auth/users* endpoints.
 *
 * SUPER_ADMIN is unrestricted. ADMIN_ONEFOP manages ONEFOP personnel only:
 * it can list, approve, reject, suspend, reactivate, delete and re-role
 * accounts whose role is one of ONEFOP_STAFF_ROLES, and can only assign
 * those roles — so it can never reach, create or grant a SUPER_ADMIN
 * account, nor touch COMPANY accounts. Staff accounts carry no DSMO/ONEFOP
 * stream in the schema, so the ONEFOP personnel set is defined by role.
 *
 * ADMIN_ONEFOP is deliberately NOT in ONEFOP_STAFF_ROLES, although the
 * role_model_refactor collapse folded four managed roles (CENTRAL,
 * DATA_MANAGER, CAMPAIGN_MANAGER, ANALYST) into it alongside the former
 * manager SUPER_ADMIN_ONEFOP. Including it would let an ADMIN_ONEFOP
 * re-role, suspend, delete and grant its own rank — a self-escalation the
 * eleven-value model prevented by keeping the manager outside the managed
 * set. Only SUPER_ADMIN may create or re-role an ADMIN_ONEFOP.
 */
export const ONEFOP_STAFF_ROLES = [
  'REGIONAL_ADMIN',
  'DIVISIONAL_ADMIN',
  'AUDITOR',
  'CENTRAL_AGENT',
] as const;

/**
 * Read-only national staff (central and attached services). Spread into the
 * @Roles of GET endpoints only -- pilotage, the establishment directory,
 * the dossier reads. Never on a mutation, never on an export: the
 * controller guard test (central-agent-read-only.spec.ts) fails if it is.
 * Its national row scope comes from READ_NATIONAL_ROLES in territory.ts.
 */
export const READ_ONLY_NATIONAL_ROLES = ['CENTRAL_AGENT'] as const;

/** National account-registration specialists. */
// ADR-0001: Module separation stays in the existing controller guard role
// sets. Keep registrations out of survey roles and submissions out of
// registration roles. CENTRAL_AGENT is read-only: no mutations or export.
// Do not create a parallel capability model; extend these sets. See
// docs/adr/0001-admin-modules-restructure.md.
export const REGISTRATION_ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN_ONEFOP',
  'ADMIN_ONEFOP_REGISTRATIONS',
  'REGIONAL_ADMIN',
  'DIVISIONAL_ADMIN',
] as const;

/** ONEFOP survey workflow staff, before read-only observers are added. */
// ADR-0001: Module separation stays in the existing controller guard role
// sets. Keep registrations out of survey roles and submissions out of
// registration roles. CENTRAL_AGENT is read-only: no mutations or export.
// Do not create a parallel capability model; extend these sets. See
// docs/adr/0001-admin-modules-restructure.md.
export const SURVEY_ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN_ONEFOP',
  'ADMIN_ONEFOP_SUBMISSIONS',
  'REGIONAL_ADMIN',
  'DIVISIONAL_ADMIN',
] as const;

export const SURVEY_READ_ROLES = [...SURVEY_ADMIN_ROLES, ...READ_ONLY_NATIONAL_ROLES] as const;

/** Roles allowed on the user-management endpoints (checked by RolesGuard). */
export const USER_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_ONEFOP'] as const;


/**
 * Roles allowed to read the establishment directory (GET /companies,
 * GET /companies/stats). Wider than USER_ADMIN_ROLES because the territorial
 * roles need the register for their own jurisdiction: both handlers scope
 * their rows with territoryFromUser/territoryWhere, so a REGIONAL_ADMIN or
 * DIVISIONAL_ADMIN sees only its own region/department. Read-only — these
 * roles get no company mutation power from being on this list.
 */
export const DIRECTORY_ROLES = [
  'SUPER_ADMIN',
  'ADMIN_ONEFOP',
  'ADMIN_ONEFOP_REGISTRATIONS',
  'REGIONAL_ADMIN',
  'DIVISIONAL_ADMIN',
  ...READ_ONLY_NATIONAL_ROLES,
] as const;

/** null = unrestricted; otherwise the only target roles the actor may manage. */
export function manageableRolesFor(actorRole: string | undefined): readonly string[] | null {
  if (actorRole === 'SUPER_ADMIN') return null;
  if (actorRole === 'ADMIN_ONEFOP') return ONEFOP_STAFF_ROLES;
  return [];
}

export function assertCanManageRole(actorRole: string | undefined, targetRole: string): void {
  const allowed = manageableRolesFor(actorRole);
  if (allowed && !allowed.includes(targetRole)) {
    throw new ForbiddenException("Ce compte ne relève pas de votre périmètre d'administration.");
  }
}

/**
 * Territorial roles that review COMPANY registrations in their own territory
 * (role-decisions D3): the company-registration list and the approve /
 * reject / request-complements routes. Deliberately NOT part of
 * USER_ADMIN_ROLES or manageableRolesFor: these roles get no user
 * management power at all -- they neither create staff accounts nor
 * approve them (decision of 2026-10-07; see assertCanApproveRegistration).
 */
export const TERRITORIAL_APPROVER_ROLES = ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN'] as const;

/**
 * Roles that may READ the staff list (GET /auth/users) -- and only read it.
 *
 * The two territorial roles are here so that a délégué can see the accounts
 * they are now expected to approve; the list itself decides what they see.
 * AuthService.listUsers gives a delegate their own territory and the roles
 * in their staffApprovalScope, and gives a territorial admin who is NOT a
 * délégué nothing at all, since manageableRolesFor returns [] for them.
 * Every mutation keeps USER_ADMIN_ROLES of its own, so this widens a read
 * and nothing else.
 */
export const STAFF_LIST_ROLES = [...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES] as const;

/**
 * The post whose holder is the DELEGATE of a territory. A territory has one
 * of each: `ServicePosition` is unique per service, and the organigramme
 * holds one DREFOP and one DDEFOP, so one délégué per region and one per
 * division.
 */
export const DELEGATE_POSITION_TYPE: Record<string, string> = {
  REGIONAL_ADMIN: 'DELEGUE_REGIONAL',
  DIVISIONAL_ADMIN: 'DELEGUE_DEPARTEMENTAL',
};

export interface StaffApprovalScope {
  /** Roles of the staff accounts this delegate may approve. */
  roles: readonly string[];
  region: string;
  /** A divisional delegate only; a regional one covers every division. */
  department?: string;
}

/**
 * What a territorial DELEGATE may approve among STAFF accounts, or null for
 * anyone who is not one.
 *
 * Keyed on the POST, not the role: every service of a regional delegation
 * maps to REGIONAL_ADMIN, so the délégué and each of their cadres hold the
 * same role, and a rule written on the role would let any cadre approve
 * their own peers. The délégué's post is what tells them apart, and
 * `positionType` has no write path after an account is created.
 *
 * Fails closed: a delegate whose own account carries no territory -- there
 * are unassigned accounts -- gets no authority from this.
 */
export function staffApprovalScope(
  actor: (Territory & { positionType?: string | null }) | null | undefined,
): StaffApprovalScope | null {
  const role = actor?.role;
  if (!actor || !role) return null;
  const delegatePost = DELEGATE_POSITION_TYPE[role];
  if (!delegatePost || actor.positionType !== delegatePost) return null;
  const region = typeof actor.region === 'string' ? actor.region.trim() : '';
  if (!region) return null;
  if (role === 'REGIONAL_ADMIN') {
    // Their region AND its divisions: the regional délégué approves the
    // divisional delegates, which is also what lets a division's FIRST
    // delegate be approved by someone other than the post being filled.
    return { roles: ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN'], region };
  }
  const department = typeof actor.department === 'string' ? actor.department.trim() : '';
  if (!department) return null;
  return { roles: ['DIVISIONAL_ADMIN'], region, department };
}

/**
 * Authorization for approving or rejecting a pending STAFF account
 * (PATCH /auth/approve-user/:id and /auth/reject-user/:id on a non-company
 * target; company files go through assertTerritorialAuthority instead).
 *
 * Two authorities, and national is always one of them:
 *
 *  - the DELEGATE of the territory the account sits in -- the regional
 *    délégué for their region and for the divisional delegates and staff
 *    inside it, the divisional délégué for their own division;
 *  - the national administration: SUPER_ADMIN for any account, ADMIN_ONEFOP
 *    for the staff roles it manages. It is the fallback at every tier, so a
 *    vacant délégué post never freezes a territory's approvals.
 *
 * A NON-delegate territorial admin -- a regional technical secretary, a
 * divisional chief of service -- approves ENTITY accounts in their territory
 * (the company path, unchanged since D3) and no staff account at all.
 *
 * History: until 2026-10-07 the territorial roles could approve staff; the
 * owner withdrew it that day and restored it on 2026-10-26 in this narrower
 * shape -- delegates only, approval only. Suspend, delete and re-role stay
 * national: manageableRolesFor returns [] for both territorial roles, and
 * those routes carry USER_ADMIN_ROLES of their own.
 */
export function assertCanApproveRegistration(
  actor: (Territory & { positionType?: string | null }) | null | undefined,
  target: {
    role: string;
    region?: string | null;
    department?: string | null;
    regionId?: string | null;
    departmentId?: string | null;
  },
): void {
  const scope = staffApprovalScope(actor);
  if (scope) {
    if (!scope.roles.includes(target.role)) {
      throw new ForbiddenException("Ce compte ne relève pas de votre périmètre d'administration.");
    }
    // Containment, from the helper the company path already uses: a regional
    // délégué matches on region, so a division inside it passes; a divisional
    // délégué matches on region AND department.
    assertTerritorialAuthority(actor as Territory, target);
    return;
  }
  assertCanManageRole(actor?.role ?? undefined, target.role);
}
