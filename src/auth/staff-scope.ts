import { ForbiddenException } from '@nestjs/common';

/**
 * Which staff accounts an administrator may see and manage through the
 * /auth/users* endpoints.
 *
 * SUPER_ADMIN is unrestricted. SUPER_ADMIN_ONEFOP manages ONEFOP personnel
 * only: it can list, approve, reject, suspend, reactivate, delete and
 * re-role accounts whose role is one of ONEFOP_STAFF_ROLES, and can only
 * assign those roles — so it can never reach, create or grant an
 * administrator (SUPER_ADMIN*) account, nor touch COMPANY accounts.
 * Staff accounts carry no DSMO/ONEFOP stream in the schema, so the ONEFOP
 * personnel set is defined by role.
 */
export const ONEFOP_STAFF_ROLES = [
  'CENTRAL',
  'REGIONAL',
  'DIVISIONAL',
  'DATA_MANAGER',
  'CAMPAIGN_MANAGER',
  'ANALYST',
  'AUDITOR',
] as const;

/** Roles allowed on the user-management endpoints (checked by RolesGuard). */
export const USER_ADMIN_ROLES = ['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP'] as const;

/** null = unrestricted; otherwise the only target roles the actor may manage. */
export function manageableRolesFor(actorRole: string | undefined): readonly string[] | null {
  if (actorRole === 'SUPER_ADMIN') return null;
  if (actorRole === 'SUPER_ADMIN_ONEFOP') return ONEFOP_STAFF_ROLES;
  return [];
}

export function assertCanManageRole(actorRole: string | undefined, targetRole: string): void {
  const allowed = manageableRolesFor(actorRole);
  if (allowed && !allowed.includes(targetRole)) {
    throw new ForbiddenException("Ce compte ne relève pas de votre périmètre d'administration.");
  }
}
