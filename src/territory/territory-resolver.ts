import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export type TxOrPrisma = Pick<PrismaClient, 'region' | 'department' | 'subdivision'>;

export interface TerritoryInput {
  regionId?: string | null;
  departmentId?: string | null;
  subdivisionId?: string | null;
  region?: string | null;
  department?: string | null;
  subdivision?: string | null;
}

export interface ResolvedTerritory {
  regionId: string;
  departmentId: string;
  subdivisionId: string | null;
  region: string;
  department: string;
  subdivision: string | null;
}

/**
 * Normalizes territory names for fuzzy/case/accent-insensitive matching.
 * E.g. "Extrême-Nord" -> "extreme nord", "Mbam-et-Inoubou" -> "mbam et inoubou".
 */
export function normalizeTerritoryName(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_'\s]+/g, ' ')
    .trim();
}

/**
 * Validates and resolves territory hierarchy against seeded database records.
 * Supports:
 *  1. ID-based chains (regionId, departmentId, optional subdivisionId)
 *  2. Name-based chains (normalized matching with parent scoping)
 *  3. Mixed input (verifies IDs and names agree)
 *
 * Rejects hierarchy mismatches (e.g. department not in region) with HTTP 400.
 */
export async function resolveAndValidateTerritory(
  prisma: TxOrPrisma,
  input: TerritoryInput,
  options?: { requireSubdivision?: boolean },
): Promise<ResolvedTerritory> {
  const hasRegionId = Boolean(input.regionId?.trim());
  const hasDeptId = Boolean(input.departmentId?.trim());
  const hasSubdivId = Boolean(input.subdivisionId?.trim());

  const hasRegionName = Boolean(input.region?.trim());
  const hasDeptName = Boolean(input.department?.trim());
  const hasSubdivName = Boolean(input.subdivision?.trim());

  if (!hasRegionId && !hasRegionName) {
    throw new BadRequestException('La région est obligatoire.');
  }

  if (!hasDeptId && !hasDeptName) {
    throw new BadRequestException('Le département est obligatoire.');
  }

  if (options?.requireSubdivision && !hasSubdivId && !hasSubdivName) {
    throw new BadRequestException("L'arrondissement est obligatoire.");
  }

  // ── 1. Resolve Region ──────────────────────────────────────────────────────
  let regionRecord: { id: string; name: string } | null = null;

  if (hasRegionId) {
    regionRecord = await prisma.region.findUnique({
      where: { id: input.regionId!.trim() },
      select: { id: true, name: true },
    });
    if (!regionRecord) {
      throw new BadRequestException(`Région introuvable (ID: '${input.regionId}').`);
    }
  } else {
    const normInputRegion = normalizeTerritoryName(input.region!);
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    regionRecord = allRegions.find(r => normalizeTerritoryName(r.name) === normInputRegion) ?? null;
    if (!regionRecord) {
      throw new BadRequestException(`Région inconnue : '${input.region}'.`);
    }
  }

  // ── 2. Resolve Department within Region ────────────────────────────────────
  let deptRecord: { id: string; name: string; regionId: string } | null = null;

  if (hasDeptId) {
    deptRecord = await prisma.department.findUnique({
      where: { id: input.departmentId!.trim() },
      select: { id: true, name: true, regionId: true },
    });
    if (!deptRecord) {
      throw new BadRequestException(`Département introuvable (ID: '${input.departmentId}').`);
    }
    if (deptRecord.regionId !== regionRecord.id) {
      throw new BadRequestException(
        `Le département '${deptRecord.name}' n'appartient pas à la région '${regionRecord.name}'.`,
      );
    }
  } else {
    const normInputDept = normalizeTerritoryName(input.department!);
    const departmentsInRegion = await prisma.department.findMany({
      where: { regionId: regionRecord.id },
      select: { id: true, name: true, regionId: true },
    });

    deptRecord = departmentsInRegion.find(d => normalizeTerritoryName(d.name) === normInputDept) ?? null;

    if (!deptRecord) {
      // Check if it exists in another region in Cameroon to provide a precise error
      const deptElsewhere = await prisma.department.findFirst({
        where: { name: { equals: input.department!.trim(), mode: 'insensitive' } },
        include: { region: true },
      });
      if (deptElsewhere) {
        throw new BadRequestException(
          `Le département '${deptElsewhere.name}' n'appartient pas à la région '${regionRecord.name}' (il appartient à la région '${deptElsewhere.region.name}').`,
        );
      }
      throw new BadRequestException(`Département inconnu : '${input.department}'.`);
    }
  }

  // ── 3. Resolve Subdivision within Department (optional) ─────────────────────
  let subdivRecord: { id: string; name: string; departmentId: string } | null = null;

  if (hasSubdivId) {
    subdivRecord = await prisma.subdivision.findUnique({
      where: { id: input.subdivisionId!.trim() },
      select: { id: true, name: true, departmentId: true },
    });
    if (!subdivRecord) {
      throw new BadRequestException(`Arrondissement introuvable (ID: '${input.subdivisionId}').`);
    }
    if (subdivRecord.departmentId !== deptRecord.id) {
      throw new BadRequestException(
        `L'arrondissement '${subdivRecord.name}' n'appartient pas au département '${deptRecord.name}'.`,
      );
    }
  } else if (hasSubdivName) {
    const normInputSubdiv = normalizeTerritoryName(input.subdivision!);
    const subdivisionsInDept = await prisma.subdivision.findMany({
      where: { departmentId: deptRecord.id },
      select: { id: true, name: true, departmentId: true },
    });

    subdivRecord = subdivisionsInDept.find(s => normalizeTerritoryName(s.name) === normInputSubdiv) ?? null;

    if (!subdivRecord) {
      const subdivElsewhere = await prisma.subdivision.findFirst({
        where: { name: { equals: input.subdivision!.trim(), mode: 'insensitive' } },
        include: { department: true },
      });
      if (subdivElsewhere) {
        throw new BadRequestException(
          `L'arrondissement '${subdivElsewhere.name}' n'appartient pas au département '${deptRecord.name}' (il appartient au département '${subdivElsewhere.department.name}').`,
        );
      }
      throw new BadRequestException(`Arrondissement inconnu : '${input.subdivision}'.`);
    }
  }

  return {
    regionId: regionRecord.id,
    departmentId: deptRecord.id,
    subdivisionId: subdivRecord ? subdivRecord.id : null,
    region: regionRecord.name,
    department: deptRecord.name,
    subdivision: subdivRecord ? subdivRecord.name : null,
  };
}

/**
 * Resolves and validates territory for staff accounts (REGIONAL, DIVISIONAL).
 * Does not require or write foreign keys on User, but ensures territory names
 * are validated against the database hierarchy and stored with canonical spelling.
 *
 * - REGIONAL: requires region, department must be null.
 * - DIVISIONAL: requires region & department; department must belong to region.
 * - Non-territorial staff roles (CENTRAL, etc.): region and department must be null.
 */
export async function resolveStaffTerritory(
  prisma: TxOrPrisma,
  role: string,
  territory: { region?: string | null; department?: string | null },
): Promise<{ region: string | null; department: string | null }> {
  if (role === 'REGIONAL') {
    if (!territory.region?.trim()) {
      throw new BadRequestException('Les utilisateurs régionaux doivent avoir une région assignée');
    }
    const normRegion = normalizeTerritoryName(territory.region);
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const regionRecord =
      allRegions.find(r => r.id === territory.region!.trim() || normalizeTerritoryName(r.name) === normRegion) ?? null;
    if (!regionRecord) {
      throw new BadRequestException(`Région inconnue : '${territory.region}'.`);
    }
    return {
      region: regionRecord.name,
      department: null,
    };
  }

  if (role === 'DIVISIONAL') {
    if (!territory.region?.trim() || !territory.department?.trim()) {
      throw new BadRequestException(
        'Les utilisateurs divisionnaires doivent avoir une région et un département assignés',
      );
    }
    const normRegion = normalizeTerritoryName(territory.region);
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const regionRecord =
      allRegions.find(r => r.id === territory.region!.trim() || normalizeTerritoryName(r.name) === normRegion) ?? null;
    if (!regionRecord) {
      throw new BadRequestException(`Région inconnue : '${territory.region}'.`);
    }

    const normDept = normalizeTerritoryName(territory.department);
    const departmentsInRegion = await prisma.department.findMany({
      where: { regionId: regionRecord.id },
      select: { id: true, name: true, regionId: true },
    });
    const deptRecord =
      departmentsInRegion.find(d => d.id === territory.department!.trim() || normalizeTerritoryName(d.name) === normDept) ??
      null;

    if (!deptRecord) {
      const deptElsewhere = await prisma.department.findFirst({
        where: { name: { equals: territory.department.trim(), mode: 'insensitive' } },
        include: { region: true },
      });
      if (deptElsewhere) {
        throw new BadRequestException(
          `Le département '${deptElsewhere.name}' n'appartient pas à la région '${regionRecord.name}' (il appartient à la région '${deptElsewhere.region.name}').`,
        );
      }
      throw new BadRequestException(`Département inconnu : '${territory.department}'.`);
    }

    return {
      region: regionRecord.name,
      department: deptRecord.name,
    };
  }

  return {
    region: null,
    department: null,
  };
}

