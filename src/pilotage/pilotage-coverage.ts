export interface CompanyStockRow {
  entityType: string | null;
  regionId: string | null;
  departmentId: string | null;
  departmentRegionId: string | null;
  establishmentId: string | null;
  establishmentIdGeneratedAt: Date | null;
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
  registered: number;
  registeredInYear: number;
  pendingApproval: number;
  pendingReview: number;
  complementsRequested: number;
}

export function emptyCounts(): StockCounts {
  return {
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

export function registeredAt(row: CompanyStockRow): Date {
  return row.establishmentIdGeneratedAt ?? row.createdAt;
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
    registered: left.registered + right.registered,
    registeredInYear: left.registeredInYear + right.registeredInYear,
    pendingApproval: left.pendingApproval + right.pendingApproval,
    pendingReview: left.pendingReview + right.pendingReview,
    complementsRequested: left.complementsRequested + right.complementsRequested,
  };
}
