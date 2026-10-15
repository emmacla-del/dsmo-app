// src/questionnaires/staff-names.ts
//
// VT table 8.8 lists the centre's staff by name. Names are personal data:
// only SUPER_ADMIN and ADMIN_ONEFOP may receive them (CLAUDE.md §21,
// 2026-10-15, the 8.8 named staff list export). The file page returns the
// respondent's flat form data (rawData), where 8.8 is stored as
// s8q8_row{n}_{lastName|firstName|sex|…}; every other role gets it without
// those keys, so a regional or divisional admin never receives a name.
import { UserRole } from '@prisma/client';

export const STAFF_NAME_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP];

const STAFF_LIST_KEY = /^s8q8_/;

export function canReadStaffNames(role: string | null | undefined): boolean {
  return typeof role === 'string' && STAFF_NAME_ROLES.includes(role);
}

/**
 * rawData as stored for a role that may read names; otherwise a copy
 * without the 8.8 keys. Anything that is not a plain object is returned
 * unchanged (no 8.8 key can hide in it).
 */
export function withoutStaffNames<T>(rawData: T, role: string | null | undefined): T {
  if (canReadStaffNames(role)) return rawData;
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return rawData;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawData as Record<string, unknown>)) {
    if (!STAFF_LIST_KEY.test(key)) kept[key] = value;
  }
  return kept as T;
}
