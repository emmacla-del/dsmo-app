import { Territory, territoryWhere } from '../auth/territory';
import { TxOrPrisma } from '../territory/territory-resolver';

export type TargetScope =
  | { kind: 'national' }
  | { kind: 'region'; regionId: string }
  | { kind: 'department'; regionId: string; departmentId: string }
  | { kind: 'none' };

/**
 * Maps territoryWhere onto regionId / departmentId.
 * The target tables have no name columns, and a live JWT user has no
 * regionId (User stores region and department as strings). A null
 * territory fails closed: territoryWhere(undefined) is national on
 * purpose for internal calls, and these routes always have an actor.
 * Name comparison is case-insensitive only, matching territoryWhere.
 */
export async function resolveTargetScope(
  prisma: TxOrPrisma,
  territory: Territory | null | undefined,
): Promise<TargetScope> {
  if (territory == null) return { kind: 'none' };

  const where = territoryWhere(territory);
  if (isNoRows(where)) return { kind: 'none' };
  if (Object.keys(where).length === 0) return { kind: 'national' };

  if (typeof where.regionId === 'string') return { kind: 'region', regionId: where.regionId };

  if (typeof where.departmentId === 'string') {
    const department = await prisma.department.findUnique({
      where: { id: where.departmentId },
      select: { id: true, regionId: true },
    });
    if (!department) return { kind: 'none' };
    return { kind: 'department', regionId: department.regionId, departmentId: department.id };
  }

  const regionName = readEquals(where.region);
  const departmentName = readEquals(where.department);
  if (!regionName) return { kind: 'none' };

  const regions = await prisma.region.findMany({ select: { id: true, name: true } });
  const region = soleMatch(regions, regionName);
  if (!region) return { kind: 'none' };
  if (!departmentName) return { kind: 'region', regionId: region.id };

  const departments = await prisma.department.findMany({
    where: { regionId: region.id },
    select: { id: true, name: true },
  });
  const department = soleMatch(departments, departmentName);
  if (!department) return { kind: 'none' };
  return { kind: 'department', regionId: region.id, departmentId: department.id };
}

function isNoRows(where: Record<string, unknown>): boolean {
  const id = where.id;
  if (!id || typeof id !== 'object') return false;
  const list = (id as { in?: unknown }).in;
  return Array.isArray(list) && list.length === 0;
}

function readEquals(filter: unknown): string | null {
  if (!filter || typeof filter !== 'object') return null;
  const equals = (filter as { equals?: unknown }).equals;
  return typeof equals === 'string' && equals.trim() !== '' ? equals : null;
}

function soleMatch<T extends { id: string; name: string }>(rows: T[], name: string): T | null {
  const wanted = name.toLowerCase();
  const matches = rows.filter((row) => row.name.toLowerCase() === wanted);
  return matches.length === 1 ? matches[0] : null;
}
