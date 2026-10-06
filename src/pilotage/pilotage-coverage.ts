export interface CompanyStockRow {
  entityType: string | null;
  regionId: string | null;
  departmentId: string | null;
  departmentRegionId: string | null;
  establishmentId: string | null;
  establishmentIdGeneratedAt: Date | null;
  /** User.approvedAt: when the account was activated. Null on legacy rows. */
  approvedAt: Date | null;
  createdAt: Date;
  status: string;
  isActive: boolean;
}

export type CoverageBucket =
  | { kind: 'central' }
  | { kind: 'unassigned' }
  | { kind: 'nullEntityType' }
  | { kind: 'department'; regionId: string; departmentId: string };

export interface StockCounts {
  /**
   * Every Company row in the territory, whatever its status. Distinct from
   * `registered`, which only counts rows meeting the registration predicate:
   * a territory with companies but no registrations has companyCount > 0 and
   * registered === 0, which is a measured zero. companyCount === 0 means there
   * is nothing to measure at all.
   */
  companyCount: number;
  registered: number;
  registeredInYear: number;
  pendingApproval: number;
  pendingReview: number;
  complementsRequested: number;
}

export function emptyCounts(): StockCounts {
  return {
    companyCount: 0,
    registered: 0,
    registeredInYear: 0,
    pendingApproval: 0,
    pendingReview: 0,
    complementsRequested: 0,
  };
}

export function doualaYearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(`${year}-01-01T00:00:00+01:00`),
    end: new Date(`${year + 1}-01-01T00:00:00+01:00`),
  };
}

export function isInDoualaYear(instant: Date, year: number): boolean {
  const { start, end } = doualaYearBounds(year);
  return instant >= start && instant < end;
}

export function hasEstablishmentId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

export function isRegistered(row: CompanyStockRow): boolean {
  return row.status === 'ACTIVE' && row.isActive === true && hasEstablishmentId(row.establishmentId);
}

/**
 * When a company counts as registered. The establishment ID is generated at
 * registration (not approval) since 20261011120000, so its timestamp no
 * longer marks activation; User.approvedAt does. Legacy rows have no
 * approvedAt (added 2026-09-30 without a backfill) but carry an ID stamped
 * at approval or by the backfill, so they keep the year they count in today.
 */
export function registeredAt(row: CompanyStockRow): Date {
  return row.approvedAt ?? row.establishmentIdGeneratedAt ?? row.createdAt;
}

export function classifyBucket(row: CompanyStockRow): CoverageBucket {
  if (row.entityType == null) return { kind: 'nullEntityType' };
  if (row.entityType === 'ADMINISTRATION') return { kind: 'central' };
  if (!row.regionId || !row.departmentId) return { kind: 'unassigned' };
  return {
    kind: 'department',
    regionId: row.departmentRegionId ?? row.regionId,
    departmentId: row.departmentId,
  };
}

export function applyRow(counts: StockCounts, row: CompanyStockRow, year: number): void {
  counts.companyCount += 1;
  if (isRegistered(row)) {
    counts.registered += 1;
    if (isInDoualaYear(registeredAt(row), year)) counts.registeredInYear += 1;
    return;
  }
  if (row.status === 'PENDING_APPROVAL') counts.pendingApproval += 1;
  else if (row.status === 'UNDER_REVIEW') counts.pendingReview += 1;
  else if (row.status === 'COMPLEMENTS_REQUESTED') counts.complementsRequested += 1;
}

export function coverageRate(registered: number, target: number | null): number | null {
  if (target == null || target <= 0) return null;
  return registered / target;
}

export function bucketKey(bucket: CoverageBucket): string {
  if (bucket.kind === 'department') return `d:${bucket.regionId}:${bucket.departmentId}`;
  return bucket.kind;
}

export function addCounts(left: StockCounts, right: StockCounts): StockCounts {
  return {
    companyCount: left.companyCount + right.companyCount,
    registered: left.registered + right.registered,
    registeredInYear: left.registeredInYear + right.registeredInYear,
    pendingApproval: left.pendingApproval + right.pendingApproval,
    pendingReview: left.pendingReview + right.pendingReview,
    complementsRequested: left.complementsRequested + right.complementsRequested,
  };
}
