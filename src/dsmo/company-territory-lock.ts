// A company's territory is the security boundary for reviewer scope
// (CLAUDE.md §14): it decides which divisional / regional staff see the
// company, its submissions and statistics. Its entityType decides which
// ONEFOP instrument it may submit (questionnaires.service.ts checks the
// submitted entityType against it). Neither may be changed by the company
// itself through a profile save or a DSMO declaration — a move goes through
// a reviewed request (docs/plans/company-location-change-requests.md).
//
// These helpers decide, for an UPDATE of an existing company, which of the
// sent values are kept. Creation is unaffected.

const TERRITORY_KEYS = [
  'region',
  'department',
  'subdivision',
  'regionId',
  'departmentId',
  'subdivisionId',
] as const;

type TerritoryKey = (typeof TERRITORY_KEYS)[number];

export interface StoredCompanyIdentity {
  region: string | null;
  department: string | null;
  subdivision: string | null;
  regionId: string | null;
  departmentId: string | null;
  subdivisionId: string | null;
  entityType?: string | null;
}

export interface IgnoredIdentityChange {
  field: 'territory' | 'entityType';
  sent: Record<string, unknown>;
  kept: Record<string, unknown>;
}

const present = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/**
 * The territory is locked once the stored company has all three levels — the
 * same condition under which the ONEFOP submit path forces Section 1
 * territory from the Company record (questionnaires.service.ts). A company
 * registered without a complete territory can still complete it.
 */
export function isTerritoryLocked(existing: StoredCompanyIdentity): boolean {
  return present(existing.region) && present(existing.department) && present(existing.subdivision);
}

const sameName = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * Returns the update data with territory and entityType changes removed when
 * they are locked, plus the list of ignored changes (for the audit log).
 * Values equal to the stored ones are not reported as changes.
 */
export function lockCompanyIdentity<T extends Record<string, unknown>>(
  existing: StoredCompanyIdentity | null,
  update: T,
): { data: Partial<T>; ignored: IgnoredIdentityChange[] } {
  if (!existing) return { data: update, ignored: [] };

  const data: Record<string, unknown> = { ...update };
  const ignored: IgnoredIdentityChange[] = [];

  if (isTerritoryLocked(existing)) {
    const sent: Record<string, unknown> = {};
    const kept: Record<string, unknown> = {};
    for (const key of TERRITORY_KEYS) delete data[key];
    const sentTerritory = TERRITORY_KEYS.some((key) => update[key] !== undefined && update[key] !== null);
    const differs =
      sentTerritory &&
      (!sameName(update.region, existing.region) ||
      !sameName(update.department, existing.department) ||
        !sameName(update.subdivision, existing.subdivision));
    if (differs) {
      for (const key of TERRITORY_KEYS) {
        sent[key] = update[key as TerritoryKey] ?? null;
        kept[key] = existing[key as TerritoryKey] ?? null;
      }
      ignored.push({ field: 'territory', sent, kept });
    }
  }

  if ('entityType' in update && present(existing.entityType ?? null)) {
    if (update.entityType !== existing.entityType) {
      ignored.push({
        field: 'entityType',
        sent: { entityType: update.entityType ?? null },
        kept: { entityType: existing.entityType },
      });
    }
    delete data.entityType;
  }

  return { data: data as Partial<T>, ignored };
}
