import {
  applyRow,
  classifyBucket,
  CompanyStockRow,
  coverageRate,
  doualaYearBounds,
  emptyCounts,
  isInDoualaYear,
  isRegistered,
} from './pilotage-coverage';

function row(overrides: Partial<CompanyStockRow> = {}): CompanyStockRow {
  return {
    entityType: 'ENTREPRISE',
    regionId: 'r1',
    departmentId: 'd1',
    departmentRegionId: 'r1',
    establishmentId: 'EN26000100',
    establishmentIdGeneratedAt: new Date('2026-06-01T10:00:00.000Z'),
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    status: 'ACTIVE',
    isActive: true,
    ...overrides,
  };
}

describe('douala year bounds', () => {
  it('opens at 00:00 Africa/Douala on 1 January and closes at the next 1 January', () => {
    const { start, end } = doualaYearBounds(2026);
    expect(start.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-31T23:00:00.000Z');
    expect(isInDoualaYear(new Date('2025-12-31T22:59:59.000Z'), 2026)).toBe(false);
    expect(isInDoualaYear(new Date('2025-12-31T23:00:00.000Z'), 2026)).toBe(true);
    expect(isInDoualaYear(new Date('2026-12-31T22:59:59.000Z'), 2026)).toBe(true);
    expect(isInDoualaYear(new Date('2026-12-31T23:00:00.000Z'), 2026)).toBe(false);
  });
});

describe('isRegistered', () => {
  it('requires ACTIVE, isActive, and a present establishment id', () => {
    expect(isRegistered(row())).toBe(true);
    expect(isRegistered(row({ isActive: false }))).toBe(false);
    expect(isRegistered(row({ establishmentId: null }))).toBe(false);
    expect(isRegistered(row({ establishmentId: '  ' }))).toBe(false);
    expect(isRegistered(row({ status: 'PENDING_APPROVAL' }))).toBe(false);
    expect(isRegistered(row({ status: 'COMPLEMENTS_REQUESTED' }))).toBe(false);
  });
});

describe('classifyBucket', () => {
  it('sends a null entity type to its own national bucket even with territory ids', () => {
    expect(classifyBucket(row({ entityType: null }))).toEqual({ kind: 'nullEntityType' });
  });

  it('sends an administration to central even with territory ids', () => {
    expect(classifyBucket(row({ entityType: 'ADMINISTRATION' }))).toEqual({ kind: 'central' });
  });

  it('sends a missing region or department to unassigned', () => {
    expect(classifyBucket(row({ regionId: null }))).toEqual({ kind: 'unassigned' });
    expect(classifyBucket(row({ departmentId: null }))).toEqual({ kind: 'unassigned' });
  });

  it('places VOCATIONAL_TRAINING_CENTER on the department, using the department region', () => {
    expect(classifyBucket(row({
      entityType: 'VOCATIONAL_TRAINING_CENTER',
      regionId: 'r-wrong',
      departmentRegionId: 'r1',
    }))).toEqual({ kind: 'department', regionId: 'r1', departmentId: 'd1' });
  });
});

describe('applyRow', () => {
  it('falls back to createdAt when establishmentIdGeneratedAt is missing', () => {
    const counts = emptyCounts();
    applyRow(counts, row({
      establishmentIdGeneratedAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    }), 2026);
    expect(counts.registered).toBe(1);
    expect(counts.registeredInYear).toBe(1);
  });

  it('tallies registered, in-year, and the three pending statuses, and skips the excluded ones', () => {
    const counts = emptyCounts();
    applyRow(counts, row(), 2026);
    applyRow(counts, row({
      establishmentIdGeneratedAt: new Date('2025-06-01T00:00:00.000Z'),
      createdAt: new Date('2025-06-01T00:00:00.000Z'),
    }), 2026);
    applyRow(counts, row({ status: 'PENDING_APPROVAL', establishmentId: null }), 2026);
    applyRow(counts, row({ status: 'UNDER_REVIEW', establishmentId: null }), 2026);
    applyRow(counts, row({ status: 'COMPLEMENTS_REQUESTED', establishmentId: null }), 2026);
    applyRow(counts, row({ status: 'DRAFT' }), 2026);
    applyRow(counts, row({ status: 'DOCUMENTS_INCOMPLETE' }), 2026);
    applyRow(counts, row({ status: 'REJECTED' }), 2026);
    applyRow(counts, row({ isActive: false }), 2026);
    applyRow(counts, row({ establishmentId: null }), 2026);
    expect(counts).toEqual({
      registered: 2,
      registeredInYear: 1,
      pendingApproval: 1,
      pendingReview: 1,
      complementsRequested: 1,
    });
  });
});

describe('coverageRate', () => {
  it('returns registered / target when the target is greater than zero', () => {
    expect(coverageRate(0, 10)).toBe(0);
    expect(coverageRate(5, 10)).toBe(0.5);
    expect(coverageRate(3, null)).toBeNull();
    expect(coverageRate(3, 0)).toBeNull();
  });
});
