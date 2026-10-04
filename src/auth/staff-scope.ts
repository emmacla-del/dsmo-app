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
] as const;

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
  'REGIONAL_ADMIN',
  'DIVISIONAL_ADMIN',
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
 * Roles that may approve or reject pending staff registrations inside their
 * own territory (role-decisions D3). Deliberately NOT part of
 * USER_ADMIN_ROLES or manageableRolesFor: these roles get no other user
 * management power (list, suspend, delete, re-role).
 */
export const TERRITORIAL_APPROVER_ROLES = ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN'] as const;

/**
 * Authorization for PATCH /auth/approve-user/:id and /auth/reject-user/:id.
 *
 * - REGIONAL_ADMIN / DIVISIONAL_ADMIN: the target must be ONEFOP staff AND
 *   inside the actor's region (REGIONAL_ADMIN) or region + department
 *   (DIVISIONAL_ADMIN), checked by assertTerritorialAuthority. A target
 *   with no region/department fails closed.
 * - Every other role: the existing assertCanManageRole rule (SUPER_ADMIN
 *   unrestricted, ADMIN_ONEFOP limited to ONEFOP staff, anyone else
 *   refused).
 */
export function assertCanApproveRegistration(
  actor: Territory,
  target: {
    role: string;
    region?: string | null;
    department?: string | null;
    regionId?: string | null;
    departmentId?: string | null;
  },
): void {
  if (actor?.role && (TERRITORIAL_APPROVER_ROLES as readonly string[]).includes(actor.role)) {
    if (!(ONEFOP_STAFF_ROLES as readonly string[]).includes(target.role)) {
      throw new ForbiddenException("Ce compte ne relève pas de votre périmètre d'administration.");
    }
    assertTerritorialAuthority(actor, target);
    return;
  }
  assertCanManageRole(actor?.role ?? undefined, target.role);
}
