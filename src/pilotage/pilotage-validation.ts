import { BadRequestException } from '@nestjs/common';

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;
/** PostgreSQL INTEGER. Larger values would fail in the database as a 500. */
export const TARGET_MAX = 2_147_483_647;

export type TargetMode = 'DEPARTMENT' | 'REGION' | 'UNSET' | 'MIXED';
export type TargetField = 'inscriptionTarget' | 'submissionTarget';

export interface TargetEntry {
  regionId: string;
  /** null is a region-level row. */
  departmentId: string | null;
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

/** Region target from stored rows. A mixed set is reported and not added up. */
export function summarizeRegion(rows: StoredTarget[]): { mode: TargetMode; target: number | null } {
  if (rows.length === 0) return { mode: 'UNSET', target: null };
  const regionRows = rows.filter((row) => row.departmentId === null);
  const departmentRows = rows.filter((row) => row.departmentId !== null);
  if (regionRows.length > 0 && departmentRows.length > 0) return { mode: 'MIXED', target: null };
  if (regionRows.length > 1) return { mode: 'MIXED', target: null };
  if (regionRows.length === 1) return { mode: 'REGION', target: regionRows[0].target };
  const target = departmentRows.reduce((sum, row) => sum + row.target, 0);
  return { mode: 'DEPARTMENT', target };
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
  if (!Object.prototype.hasOwnProperty.call(record, field)) {
    throw new BadRequestException(`La ligne ${line} : « ${field} » doit être un entier positif ou nul.`);
  }
  const target = requireTarget(record[field], `La ligne ${line} : « ${field} » doit être un entier positif ou nul.`);
  return { kind: 'target', entry: { regionId, departmentId, target }, line };
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
  return `${entry.regionId}\u0000${entry.departmentId ?? ''}`;
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
  const byRegion = new Map<string, { regionLevel: boolean; departmentLevel: boolean }>();
  for (const entry of entries) {
    const flags = byRegion.get(entry.regionId) ?? { regionLevel: false, departmentLevel: false };
    if (entry.departmentId === null) flags.regionLevel = true;
    else flags.departmentLevel = true;
    if (flags.regionLevel && flags.departmentLevel) {
      const name = regionNames?.get(entry.regionId) ?? entry.regionId;
      throw new BadRequestException(
        `La région « ${name} » mélange un objectif régional et des objectifs départementaux.`,
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
