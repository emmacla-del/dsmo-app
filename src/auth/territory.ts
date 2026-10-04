import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Geographic jurisdiction of a staff account. Administrative boundaries are
 * a security boundary: REGIONAL_ADMIN agents only see and act on their
 * region, DIVISIONAL_ADMIN agents on their department; SUPER_ADMIN and
 * ADMIN_ONEFOP are national.
 */
export interface Territory {
  role?: string | null;
  region?: string | null;
  department?: string | null;
  regionId?: string | null;
  departmentId?: string | null;
}

const NATIONAL_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP];

/**
 * Roles with national scope on the ONEFOP statistical exports only
 * (role-decisions D7). Deliberately separate from NATIONAL_ROLES, which also
 * drives assertTerritorialAuthority: these roles must not gain national
 * write scope (visa, reject, anomaly resolution) through this list.
 *
 * NOTE (role_model_refactor): the three roles that made this list wider than
 * NATIONAL_ROLES — SUPER_ADMIN_DSMO, DATA_MANAGER, ANALYST — now map onto
 * SUPER_ADMIN / ADMIN_ONEFOP, which are already national here. The two lists
 * are consequently identical and D7 draws no distinction under the six-value
 * model. The seam is kept (rather than collapsed into NATIONAL_ROLES) so a
 * future read-only national role can be added here without also granting
 * national write scope. The read-only national scope DATA_MANAGER and
 * ANALYST used to have was intentionally absorbed into ADMIN_ONEFOP's write
 * scope by that collapse — this is a ruled decision, not an oversight.
 */
const EXPORT_NATIONAL_ROLES: string[] = [...NATIONAL_ROLES];

/** Prisma filter that matches no row — used to fail closed. */
const NO_ROWS = { id: { in: [] as string[] } };

/** Trimmed name, or null when absent/blank (a blank name is no assignment). */
function cleanName(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Case-insensitive equality on a territory name column. On PostgreSQL Prisma
 * compiles this to LOWER(col) = LOWER($1), so 'CENTRE' matches 'Centre'.
 */
function nameEquals(value: string) {
  return { equals: value, mode: 'insensitive' as const };
}

/** JS mirror of nameEquals, for rows already loaded. */
function sameName(actorValue?: string | null, targetValue?: string | null): boolean {
  const actor = cleanName(actorValue);
  return !!actor && typeof targetValue === 'string' && actor.toLowerCase() === targetValue.toLowerCase();
}

export function territoryFromUser(user: any): Territory {
  return {
    role: user?.role ?? null,
    region: user?.region ?? null,
    department: user?.department ?? null,
    regionId: user?.regionId ?? null,
    departmentId: user?.departmentId ?? null,
  };
}

/**
 * Prisma `where` fragment restricting OnefopSubmission rows to a territory.
 *
 * `undefined`/`null` means an internal call with no acting user (e.g.
 * assertCanApprove → evaluateDossier) and applies no restriction. A
 * Territory object is always an acting user: an unknown or missing role,
 * or a REGIONAL_ADMIN/DIVISIONAL_ADMIN account without an assignment,
 * fails closed (matches nothing) — it never falls through to an unscoped
 * query.
 *
 * Names match case-insensitively. DIVISIONAL_ADMIN matches region AND
 * department by name, because department names repeat across regions; a
 * departmentId is globally unique and suffices on its own.
 */
export function territoryWhere(territory?: Territory | null): Record<string, unknown> {
  return territoryWhereWithRoles(territory, NATIONAL_ROLES);
}

/**
 * territoryWhere for the ONEFOP export endpoints (role-decisions D7):
 * identical, except that EXPORT_NATIONAL_ROLES also read nationally.
 * Use only for export where-builders — never for a route that mutates.
 */
export function territoryWhereForExport(territory?: Territory | null): Record<string, unknown> {
  return territoryWhereWithRoles(territory, EXPORT_NATIONAL_ROLES);
}

function territoryWhereWithRoles(
  territory: Territory | null | undefined,
  nationalRoles: string[],
): Record<string, unknown> {
  if (territory === undefined || territory === null) return {};

  const role = territory.role;
  if (role && nationalRoles.includes(role)) return {};

  if (role === UserRole.REGIONAL_ADMIN) {
    if (territory.regionId) return { regionId: territory.regionId };
    const region = cleanName(territory.region);
    if (region) return { region: nameEquals(region) };
    return NO_ROWS;
  }

  if (role === UserRole.DIVISIONAL_ADMIN) {
    if (territory.departmentId) return { departmentId: territory.departmentId };
    const region = cleanName(territory.region);
    const department = cleanName(territory.department);
    if (region && department) return { region: nameEquals(region), department: nameEquals(department) };
    return NO_ROWS;
  }

  return NO_ROWS;
}

/**
 * Throws ForbiddenException unless `actor` may act on `target`.
 * Messages are recorded in audit trails — keep them stable.
 */
export function assertTerritorialAuthority(
  actor: Territory,
  target: {
    region?: string | null;
    department?: string | null;
    regionId?: string | null;
    departmentId?: string | null;
  },
): void {
  if (!actor?.role) {
    throw new ForbiddenException('Authentification requise.');
  }

  if (NATIONAL_ROLES.includes(actor.role)) {
    return; // National jurisdiction
  }

  if (actor.role === UserRole.REGIONAL_ADMIN) {
    const matchRegion = (actor.regionId && actor.regionId === target.regionId) ||
                        sameName(actor.region, target.region);
    if (!matchRegion) {
      throw new ForbiddenException(`Action non autorisée hors de votre région d'affectation (${actor.region}).`);
    }
    return;
  }

  if (actor.role === UserRole.DIVISIONAL_ADMIN) {
    // Region AND department: department names repeat across regions. A region
    // mismatch reports the department message, kept stable for audit logs.
    const matchDept = (actor.departmentId && actor.departmentId === target.departmentId) ||
                      (sameName(actor.region, target.region) && sameName(actor.department, target.department));
    if (!matchDept) {
      throw new ForbiddenException(`Action non autorisée hors de votre département d'affectation (${actor.department}).`);
    }
    return;
  }

  throw new ForbiddenException('Privilèges territoriaux insuffisants.');
}
