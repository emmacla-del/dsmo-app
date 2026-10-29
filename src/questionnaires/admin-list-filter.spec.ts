import { ADMIN_LIST_FORM_TYPES, ADMIN_LIST_STATUSES, buildAdminListWhere, periodStart } from './admin-list-filter';
import { reviewOverdueBefore } from './review-delay';

// Drafts never listed; replaced files (SUPERSEDED) only when asked for.
const NOT_DRAFT = { status: { notIn: ['DRAFT', 'SUPERSEDED'] } };
const NOW = new Date('2026-09-29T12:00:00.000Z');

describe('buildAdminListWhere', () => {
  it('always excludes drafts, even with no filter and no territory', () => {
    expect(buildAdminListWhere({})).toEqual({ AND: [{}, NOT_DRAFT, { archivedAt: null }] });
  });

  it('lists replaced files (SUPERSEDED) only when the status filter asks for them', () => {
    const where = buildAdminListWhere({ status: 'SUPERSEDED' });
    expect(where.AND[1]).toEqual({ status: { notIn: ['DRAFT'] } });
    expect(where.AND).toContainEqual({ status: 'SUPERSEDED' });
  });

  it('puts the territory first, then the draft exclusion, then each filter, all under AND', () => {
    const where = buildAdminListWhere(
      { status: 'APPROVED', formType: 'COOPERATIVE', region: 'Centre', period: '30d', search: 'sodecoton' },
      { role: 'REGIONAL_ADMIN', region: 'Littoral' },
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
    const where = buildAdminListWhere({ region: 'Centre' }, { role: 'REGIONAL_ADMIN', region: 'Littoral' });
    expect(where).not.toHaveProperty('region');
    expect(where.AND).toContainEqual({ region: { equals: 'Littoral', mode: 'insensitive' } });
  });

  it('fails closed for an unassigned territorial account, whatever the filters', () => {
    expect(buildAdminListWhere({ region: 'Centre' }, { role: 'REGIONAL_ADMIN' }).AND[0]).toEqual({ id: { in: [] } });
  });

  it('adds no period condition for "Toutes les périodes"', () => {
    expect(buildAdminListWhere({}).AND.some((c) => 'createdAt' in c)).toBe(false);
  });

  it('filters by companyId under AND when provided', () => {
    const where = buildAdminListWhere({ companyId: 'comp-123' });
    expect(where.AND).toContainEqual({ companyId: 'comp-123' });
  });

  it('filters department, campaign, quarter and late files under AND', () => {
    const where = buildAdminListWhere({
      department: 'Moungo',
      campaignId: 'campaign-1',
      quarterCode: '2026-T4',
      late: true,
    });
    expect(where.AND).toContainEqual({ department: { equals: 'Moungo', mode: 'insensitive' } });
    expect(where.AND).toContainEqual({ campaignId: 'campaign-1' });
    expect(where.AND).toContainEqual({ quarterCode: '2026-T4' });
    expect(where.AND).toContainEqual({ isLate: true });
  });

  it('treats late=false as no filter', () => {
    const where = buildAdminListWhere({ late: false });
    expect(where.AND.some((condition) => 'isLate' in condition)).toBe(false);
  });

  it('filters overdue files with the pilotage queue threshold, pending only', () => {
    const where = buildAdminListWhere({ overdue: true }, undefined, NOW);
    expect(where.AND).toContainEqual({
      status: 'PENDING_REVIEW',
      submissionDate: { lt: reviewOverdueBefore(NOW) },
    });
  });

  it('adds no campaign clause when campaignId is absent, so every campaign is listed', () => {
    for (const filters of [{}, { campaignId: undefined }, { campaignId: '' }]) {
      const where = buildAdminListWhere(filters);
      expect(where.AND.some((clause) => 'campaignId' in clause)).toBe(false);
    }
  });

  it('filters clean files as those with no OPEN anomaly', () => {
    const where = buildAdminListWhere({ quality: 'clean' });
    expect(where.AND).toContainEqual({ anomalies: { none: { status: 'OPEN' } } });
    expect(where.AND.filter((clause) => 'anomalies' in clause)).toHaveLength(1);
  });

  it('filters warnings as an OPEN non-blocking anomaly and no OPEN blocking anomaly', () => {
    const where = buildAdminListWhere({ quality: 'warnings' });
    expect(where.AND).toContainEqual({ anomalies: { some: { status: 'OPEN', isBlocking: false } } });
    expect(where.AND).toContainEqual({ anomalies: { none: { status: 'OPEN', isBlocking: true } } });
  });

  it('filters blocking files as those with an OPEN blocking anomaly', () => {
    const where = buildAdminListWhere({ quality: 'blocking' });
    expect(where.AND).toContainEqual({ anomalies: { some: { status: 'OPEN', isBlocking: true } } });
  });

  it('counts a file whose blocking anomalies are all RESOLVED or WAIVED as clean, not blocking', () => {
    // The Contrôles column counts status OPEN only. RESOLVED and WAIVED are
    // the stored non-open states (there is no CLOSED value). A file that
    // holds only those matches `none: OPEN` and does not match `some: OPEN`.
    const clean = buildAdminListWhere({ quality: 'clean' }).AND.find((clause) => 'anomalies' in clause);
    const blocking = buildAdminListWhere({ quality: 'blocking' }).AND.find((clause) => 'anomalies' in clause);
    expect(clean).toEqual({ anomalies: { none: { status: 'OPEN' } } });
    expect(blocking).toEqual({ anomalies: { some: { status: 'OPEN', isBlocking: true } } });
    expect(JSON.stringify(clean)).not.toContain('RESOLVED');
    expect(JSON.stringify(clean)).not.toContain('WAIVED');
    expect(JSON.stringify(blocking)).toContain('"status":"OPEN"');
    expect(JSON.stringify(blocking)).toContain('"isBlocking":true');
  });

  it('filters assignment me, unassigned and other against the signed-in officer', () => {
    expect(buildAdminListWhere({ assignment: 'me', assigneeId: 'officer-1' }).AND)
      .toContainEqual({ assigneeId: 'officer-1' });
    expect(buildAdminListWhere({ assignment: 'unassigned' }).AND)
      .toContainEqual({ assigneeId: null });
    expect(buildAdminListWhere({ assignment: 'other', assigneeId: 'officer-1' }).AND)
      .toContainEqual({ AND: [{ assigneeId: { not: null } }, { assigneeId: { not: 'officer-1' } }] });
  });

  it('matches nothing for me or other when the officer id is missing', () => {
    expect(buildAdminListWhere({ assignment: 'me' }).AND).toContainEqual({ id: { in: [] } });
    expect(buildAdminListWhere({ assignment: 'other' }).AND).toContainEqual({ id: { in: [] } });
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
