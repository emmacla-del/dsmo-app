import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Geographic jurisdiction of a staff account. Administrative boundaries are
 * a security boundary: REGIONAL agents only see and act on their region,
 * DIVISIONAL agents on their department; SUPER_ADMIN, SUPER_ADMIN_ONEFOP
 * and CENTRAL are national.
 */
export interface Territory {
  role?: string | null;
  region?: string | null;
  department?: string | null;
  regionId?: string | null;
  departmentId?: string | null;
}

const NATIONAL_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL];

/** Prisma filter that matches no row — used to fail closed. */
const NO_ROWS = { id: { in: [] as string[] } };

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
 * or a REGIONAL/DIVISIONAL account without an assignment, fails closed
 * (matches nothing) — it never falls through to an unscoped query.
 */
export function territoryWhere(territory?: Territory | null): Record<string, unknown> {
  if (territory === undefined || territory === null) return {};

  const role = territory.role;
  if (role && NATIONAL_ROLES.includes(role)) return {};

  if (role === UserRole.REGIONAL) {
    if (territory.regionId) return { regionId: territory.regionId };
    if (territory.region) return { region: territory.region };
    return NO_ROWS;
  }

  if (role === UserRole.DIVISIONAL) {
    if (territory.departmentId) return { departmentId: territory.departmentId };
    if (territory.department) return { department: territory.department };
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

  if (actor.role === UserRole.REGIONAL) {
    const matchRegion = (actor.regionId && actor.regionId === target.regionId) ||
                        (actor.region && actor.region === target.region);
    if (!matchRegion) {
      throw new ForbiddenException(`Action non autorisée hors de votre région d'affectation (${actor.region}).`);
    }
    return;
  }

  if (actor.role === UserRole.DIVISIONAL) {
    const matchDept = (actor.departmentId && actor.departmentId === target.departmentId) ||
                      (actor.department && actor.department === target.department);
    if (!matchDept) {
      throw new ForbiddenException(`Action non autorisée hors de votre département d'affectation (${actor.department}).`);
    }
    return;
  }

  throw new ForbiddenException('Privilèges territoriaux insuffisants.');
}
