import { ADMIN_LIST_FORM_TYPES, ADMIN_LIST_STATUSES, buildAdminListWhere, periodStart } from './admin-list-filter';

const NOT_DRAFT = { status: { not: 'DRAFT' } };
const NOW = new Date('2026-09-29T12:00:00.000Z');

describe('buildAdminListWhere', () => {
  it('always excludes drafts, even with no filter and no territory', () => {
    expect(buildAdminListWhere({})).toEqual({ AND: [{}, NOT_DRAFT] });
  });

  it('puts the territory first, then the draft exclusion, then each filter, all under AND', () => {
    const where = buildAdminListWhere(
      { status: 'APPROVED', formType: 'COOPERATIVE', region: 'Centre', period: '30d', search: 'sodecoton' },
      { role: 'REGIONAL', region: 'Littoral' },
      NOW,
    );
    expect(where.AND[0]).toEqual({ region: { equals: 'Littoral', mode: 'insensitive' } });
    expect(where.AND[1]).toEqual(NOT_DRAFT);
    expect(where.AND).toContainEqual({ status: 'APPROVED' });
    expect(where.AND).toContainEqual({ formType: 'COOPERATIVE' });
    expect(where.AND).toContainEqual({ region: { equals: 'Centre', mode: 'insensitive' } });
    expect(where.AND).toContainEqual({ createdAt: { gte: new Date('2026-08-30T12:00:00.000Z') } });
    const search = where.AND.find((c) => 'OR' in c) as { OR: unknown[] };
    expect(search.OR).toEqual(
      expect.arrayContaining([
        { submissionId: { contains: 'sodecoton', mode: 'insensitive' } },
        { respondent: { respondentName: { contains: 'sodecoton', mode: 'insensitive' } } },
        { enterpriseDetail: { companyName: { contains: 'sodecoton', mode: 'insensitive' } } },
      ]),
    );
  });

  it('never lets a region filter replace the caller territory (scope escape)', () => {
    // A REGIONAL Littoral agent asking for region=Centre gets Littoral AND Centre (nothing).
    const where = buildAdminListWhere({ region: 'Centre' }, { role: 'REGIONAL', region: 'Littoral' });
    expect(where).not.toHaveProperty('region');
    expect(where.AND).toContainEqual({ region: { equals: 'Littoral', mode: 'insensitive' } });
  });

  it('fails closed for an unassigned territorial account, whatever the filters', () => {
    expect(buildAdminListWhere({ region: 'Centre' }, { role: 'REGIONAL' }).AND[0]).toEqual({ id: { in: [] } });
  });

  it('adds no period condition for "Toutes les périodes"', () => {
    expect(buildAdminListWhere({}).AND.some((c) => 'createdAt' in c)).toBe(false);
  });
});

describe('periodStart', () => {
  it('counts days for 7d/30d and calendar months for 3m/12m', () => {
    expect(periodStart('7d', NOW).toISOString()).toBe('2026-09-22T12:00:00.000Z');
    expect(periodStart('30d', NOW).toISOString()).toBe('2026-08-30T12:00:00.000Z');
    expect(periodStart('3m', NOW).toISOString()).toBe('2026-06-29T12:00:00.000Z');
    expect(periodStart('12m', NOW).toISOString()).toBe('2025-09-29T12:00:00.000Z');
  });

  it('does not mutate now', () => {
    const now = new Date(NOW);
    periodStart('12m', now);
    expect(now).toEqual(NOW);
  });
});

describe('admin list vocabularies', () => {
  it('never offers DRAFT or the deprecated questionnaire type', () => {
    expect(ADMIN_LIST_STATUSES).not.toContain('DRAFT');
    expect(ADMIN_LIST_STATUSES).toEqual(expect.arrayContaining(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED']));
    expect(ADMIN_LIST_FORM_TYPES).not.toContain('VOCATIONAL_TRAINING_CENTER');
    expect(ADMIN_LIST_FORM_TYPES).toHaveLength(7);
  });
});
