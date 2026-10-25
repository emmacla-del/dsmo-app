import { BadRequestException } from '@nestjs/common';

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;
/** PostgreSQL INTEGER. Larger values would fail in the database as a 500. */
export const TARGET_MAX = 2_147_483_647;

export type TargetMode = 'DEPARTMENT' | 'REGION' | 'ENTITY_TYPE' | 'UNSET' | 'MIXED';
export type TargetField = 'inscriptionTarget' | 'submissionTarget';

/**
 * The entity types a quota may name, in the registration screen's order.
 * Declared here rather than imported from pilotage-returns so the validator
 * keeps no dependency on the returns module; a spec pins the two equal.
 */
export const QUOTA_ENTITY_TYPES: readonly string[] = [
  'ENTREPRISE',
  'COOPERATIVE',
  'CTD',
  'ONG',
  'ADMINISTRATION',
  'PROJECT_PROGRAM',
  'VOCATIONAL_TRAINING',
];

export interface TargetEntry {
  regionId: string;
  /** null is a region-level row. */
  departmentId: string | null;
  /**
   * null is a row covering every entity type, which is what every quota
   * written before 2026-10-25 is. A named type is region level only.
   */
  entityType: string | null;
  target: number;
}

export interface ParsedTargetBody {
  entries: TargetEntry[];
  clearedRegionIds: string[];
  /**
   * undefined: the key was absent, leave the stored central value.
   * null: delete it.
   * number: upsert it.
   */
  central: number | null | undefined;
}

export interface StoredTarget {
  departmentId: string | null;
  entityType: string | null;
  target: number;
}

const YEAR_INVALID = 'Le paramètre « year » doit être une année entre 2000 et 2100.';

export function parseYear(raw: unknown): number {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    throw new BadRequestException('Le paramètre « year » est obligatoire.');
  }
  if (Array.isArray(raw) || typeof raw === 'object') {
    throw new BadRequestException(YEAR_INVALID);
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) throw new BadRequestException(YEAR_INVALID);
  const year = Number(text);
  if (year < YEAR_MIN || year > YEAR_MAX) throw new BadRequestException(YEAR_INVALID);
  return year;
}

export function parseTargetBody(body: unknown, field: TargetField): ParsedTargetBody {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Le corps de la requête est invalide.');
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.entries)) {
    throw new BadRequestException('Le champ « entries » doit être un tableau.');
  }
  const parsedItems = record.entries.map((item, index) => parseEntry(item, index, field));
  const entries: TargetEntry[] = [];
  const clearedRegionIds: string[] = [];

  for (const item of parsedItems) {
    if (item.kind === 'clear') {
      clearedRegionIds.push(item.regionId);
    } else {
      entries.push(item.entry);
    }
  }

  assertUniqueEntries(parsedItems);

  let central: number | null | undefined;
  if (Object.prototype.hasOwnProperty.call(record, 'central')) {
    central = parseCentral(record.central, field);
  }
  return { entries, clearedRegionIds, central };
}

export function assertEntryCount(count: number, cap: number): void {
  if (count > cap) {
    throw new BadRequestException(
      `Le corps contient ${count} lignes, au-delà des ${cap} territoires connus.`,
    );
  }
}

/**
 * Region target from stored rows. A mixed set is reported and not added up.
 *
 * Three ways to quota a region, and only one may be in use at a time:
 *  - one region-level row covering every type      -> REGION
 *  - one region-level row per entity type          -> ENTITY_TYPE
 *  - one row per department, every type            -> DEPARTMENT
 *
 * Any two together are MIXED with no target, the rule that has always
 * governed the region/department pair: the figures measure overlapping
 * populations, so a sum would count the same registrations twice and the
 * grid would state a total it cannot justify. Per-type rows DO sum, because
 * the types partition the register — a company has exactly one entityType.
 */
export function summarizeRegion(rows: StoredTarget[]): { mode: TargetMode; target: number | null } {
  if (rows.length === 0) return { mode: 'UNSET', target: null };
  const departmentRows = rows.filter((row) => row.departmentId !== null);
  const allTypeRows = rows.filter((row) => row.departmentId === null && row.entityType === null);
  const typedRows = rows.filter((row) => row.departmentId === null && row.entityType !== null);

  const axes = [allTypeRows.length > 0, typedRows.length > 0, departmentRows.length > 0]
    .filter(Boolean).length;
  if (axes > 1) return { mode: 'MIXED', target: null };

  if (allTypeRows.length > 1) return { mode: 'MIXED', target: null };
  if (allTypeRows.length === 1) return { mode: 'REGION', target: allTypeRows[0].target };
  if (typedRows.length > 0) {
    // Duplicate types cannot reach here: entryKey and the stored grain both
    // key on (region, department, type), so one row per type is the most
    // there can be.
    return { mode: 'ENTITY_TYPE', target: typedRows.reduce((sum, row) => sum + row.target, 0) };
  }
  return { mode: 'DEPARTMENT', target: departmentRows.reduce((sum, row) => sum + row.target, 0) };
}

type ParsedItem =
  | { kind: 'target'; entry: TargetEntry; line: number }
  | { kind: 'clear'; regionId: string; line: number };

function parseEntry(item: unknown, index: number, field: TargetField): ParsedItem {
  const line = index + 1;
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new BadRequestException(`La ligne ${line} est invalide.`);
  }
  const record = item as Record<string, unknown>;
  const regionId = requireId(record.regionId, `La ligne ${line} doit indiquer une région.`);

  if (Object.prototype.hasOwnProperty.call(record, 'clear')) {
    if (record.clear !== true) {
      throw new BadRequestException(`La ligne ${line} : le champ « clear » doit valoir true.`);
    }
    if (Object.prototype.hasOwnProperty.call(record, 'departmentId') && record.departmentId !== null) {
      throw new BadRequestException(
        `La ligne ${line} : l'option « clear » s'applique uniquement à une région entière.`,
      );
    }
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      throw new BadRequestException(
        `La ligne ${line} : « clear » ne peut pas être combiné avec une valeur cible.`,
      );
    }
    return { kind: 'clear', regionId, line };
  }

  let departmentId: string | null = null;
  if (Object.prototype.hasOwnProperty.call(record, 'departmentId') && record.departmentId !== null) {
    if (typeof record.departmentId !== 'string' || record.departmentId.trim() === '') {
      throw new BadRequestException(
        `La ligne ${line} : un département vide n'est pas un objectif régional.`,
      );
    }
    departmentId = record.departmentId.trim();
  }
  let entityType: string | null = null;
  if (Object.prototype.hasOwnProperty.call(record, 'entityType') && record.entityType !== null) {
    if (typeof record.entityType !== 'string' || !QUOTA_ENTITY_TYPES.includes(record.entityType)) {
      throw new BadRequestException(
        `La ligne ${line} : « entityType » doit être un type d'entité connu ou null.`,
      );
    }
    // Region x type is the grain in force. A department-level row naming a
    // type would be a quota nothing measures: coverageFrom tallies types over
    // the region, and the editor offers no such cell.
    if (departmentId !== null) {
      throw new BadRequestException(
        `La ligne ${line} : un quota par type d'entité se définit au niveau régional, pas départemental.`,
      );
    }
    entityType = record.entityType;
  }
  if (!Object.prototype.hasOwnProperty.call(record, field)) {
    throw new BadRequestException(`La ligne ${line} : « ${field} » doit être un entier positif ou nul.`);
  }
  const target = requireTarget(record[field], `La ligne ${line} : « ${field} » doit être un entier positif ou nul.`);
  return { kind: 'target', entry: { regionId, departmentId, entityType, target }, line };
}

function parseCentral(value: unknown, field: TargetField): number | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('« central » doit être un objet ou null.');
  }
  const record = value as Record<string, unknown>;
  return requireTarget(record[field], `« central.${field} » doit être un entier positif ou nul.`);
}

function requireId(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(message);
  return value.trim();
}

function requireTarget(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > TARGET_MAX) {
    throw new BadRequestException(message);
  }
  return value;
}

function entryKey(entry: TargetEntry): string {
  return `${entry.regionId}\u0000${entry.departmentId ?? ''}\u0000${entry.entityType ?? ''}`;
}

function assertUniqueEntries(items: ParsedItem[]): void {
  const seen = new Map<string, number>();
  items.forEach((item, index) => {
    const key = item.kind === 'clear' ? `${item.regionId}\u0000clear` : entryKey(item.entry);
    const first = seen.get(key);
    if (first !== undefined) {
      throw new BadRequestException(
        `La ligne ${index + 1} répète un territoire déjà présent dans la requête.`,
      );
    }
    seen.set(key, first ?? index);
  });
}

export function assertNoMixedMode(
  entries: TargetEntry[],
  regionNames?: Map<string, string>,
): void {
  const byRegion = new Map<string, { regionLevel: boolean; typeLevel: boolean; departmentLevel: boolean }>();
  for (const entry of entries) {
    const flags = byRegion.get(entry.regionId)
      ?? { regionLevel: false, typeLevel: false, departmentLevel: false };
    if (entry.departmentId !== null) flags.departmentLevel = true;
    else if (entry.entityType !== null) flags.typeLevel = true;
    else flags.regionLevel = true;
    const name = regionNames?.get(entry.regionId) ?? entry.regionId;
    if (flags.regionLevel && flags.departmentLevel) {
      throw new BadRequestException(
        `La région « ${name} » mélange un objectif régional et des objectifs départementaux.`,
      );
    }
    // The same rule on the new axis: a region total and per-type rows
    // measure the same registrations, so one of them has to go.
    if (flags.typeLevel && (flags.regionLevel || flags.departmentLevel)) {
      throw new BadRequestException(
        `La région « ${name} » mélange des quotas par type d'entité avec un quota régional ou départemental.`,
      );
    }
    byRegion.set(entry.regionId, flags);
  }
}

export function assertNoMixedClear(
  entries: TargetEntry[],
  clearedRegionIds: string[],
  regionNames?: Map<string, string>,
): void {
  const clearedSet = new Set(clearedRegionIds);
  for (const entry of entries) {
    if (clearedSet.has(entry.regionId)) {
      const name = regionNames?.get(entry.regionId) ?? entry.regionId;
      throw new BadRequestException(
        `La région « ${name} » ne peut pas combiner « clear » avec d'autres lignes.`,
      );
    }
  }
}
