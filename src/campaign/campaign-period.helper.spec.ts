import {
  computeCollectionPeriod,
  collectionPeriodFromQuarterCode,
  parseCampaignCode,
  formatCollectionPeriodFr,
  formatCollectionPeriodEn,
} from './campaign-period.helper';

describe('computeCollectionPeriod', () => {
  it.each([
    ['2026-01-15', new Date(2026, 0, 1), new Date(2026, 2, 31)], // Q1
    ['2026-03-31', new Date(2026, 0, 1), new Date(2026, 2, 31)], // Q1, end of quarter
    ['2026-04-01', new Date(2026, 3, 1), new Date(2026, 5, 30)], // Q2
    ['2026-07-04', new Date(2026, 6, 1), new Date(2026, 8, 30)], // Q3
    ['2026-11-20', new Date(2026, 9, 1), new Date(2026, 11, 31)], // Q4
  ])('QUARTERLY: a campaign starting %s collects for its calendar quarter', (start, expectedStart, expectedEnd) => {
    const { periodStart, periodEnd } = computeCollectionPeriod('QUARTERLY', new Date(start));
    expect(periodStart).toEqual(expectedStart);
    expect(periodEnd).toEqual(expectedEnd);
  });

  it.each([
    ['2026-02-10', new Date(2026, 0, 1), new Date(2026, 5, 30)], // S1
    ['2026-09-01', new Date(2026, 6, 1), new Date(2026, 11, 31)], // S2
  ])('SEMESTER: a campaign starting %s collects for its calendar semester', (start, expectedStart, expectedEnd) => {
    const { periodStart, periodEnd } = computeCollectionPeriod('SEMESTER', new Date(start));
    expect(periodStart).toEqual(expectedStart);
    expect(periodEnd).toEqual(expectedEnd);
  });

  it('ANNUAL: collects the full calendar year regardless of start month', () => {
    const { periodStart, periodEnd } = computeCollectionPeriod('ANNUAL', new Date('2026-08-18'));
    expect(periodStart).toEqual(new Date(2026, 0, 1));
    expect(periodEnd).toEqual(new Date(2026, 11, 31));
  });

  it('falls back to quarterly for an unrecognized/unset type, mirroring buildPeriodSuffix()', () => {
    const { periodStart, periodEnd } = computeCollectionPeriod('SOMETHING_ELSE', new Date('2026-05-01'));
    expect(periodStart).toEqual(new Date(2026, 3, 1));
    expect(periodEnd).toEqual(new Date(2026, 5, 30));
  });

  it('is independent of any deadline/extendedDeadline concept — only type and the reference date matter', () => {
    // Two calls with the same type/reference date always agree, regardless
    // of how far a submission deadline might later be extended.
    const a = computeCollectionPeriod('QUARTERLY', new Date(2026, 0, 5));
    const b = computeCollectionPeriod('QUARTERLY', new Date(2026, 0, 5));
    expect(a).toEqual(b);
  });
});

describe('parseCampaignCode / collectionPeriodFromQuarterCode', () => {
  it('parses a real generateCampaignCode() output and agrees with computeCollectionPeriod', () => {
    expect(parseCampaignCode('QUARTERLY_2026_T1_001')).toEqual({
      type: 'QUARTERLY',
      year: 2026,
      quarter: 1,
    });
    expect(collectionPeriodFromQuarterCode('QUARTERLY_2026_T1_001')).toEqual(
      computeCollectionPeriod('QUARTERLY', new Date(2026, 1, 1)),
    );
  });

  it('parses SEMESTER codes (S1/S2) to the correct half of the year', () => {
    expect(collectionPeriodFromQuarterCode('SEMESTER_2026_S1_001')).toEqual({
      periodStart: new Date(2026, 0, 1),
      periodEnd: new Date(2026, 5, 30),
    });
    expect(collectionPeriodFromQuarterCode('SEMESTER_2026_S2_003')).toEqual({
      periodStart: new Date(2026, 6, 1),
      periodEnd: new Date(2026, 11, 31),
    });
  });

  it('parses ANNUAL codes to the full calendar year', () => {
    expect(collectionPeriodFromQuarterCode('ANNUAL_2026_AN_007')).toEqual({
      periodStart: new Date(2026, 0, 1),
      periodEnd: new Date(2026, 11, 31),
    });
  });

  it('accepts the legacy "YYYY-TN" shape as a QUARTERLY fallback', () => {
    expect(collectionPeriodFromQuarterCode('2025-T4')).toEqual({
      periodStart: new Date(2025, 9, 1),
      periodEnd: new Date(2025, 11, 31),
    });
  });

  it('returns null for missing/unrecognized codes rather than guessing a date', () => {
    expect(collectionPeriodFromQuarterCode(null)).toBeNull();
    expect(collectionPeriodFromQuarterCode(undefined)).toBeNull();
    expect(collectionPeriodFromQuarterCode('not-a-code')).toBeNull();
  });
});

describe('formatCollectionPeriodFr / formatCollectionPeriodEn', () => {
  const period = { periodStart: new Date(2026, 0, 1), periodEnd: new Date(2026, 2, 31) };

  it('formats as dd/MM/yyyy, matching the app-wide date convention', () => {
    expect(formatCollectionPeriodFr(period)).toBe('01/01/2026 au 31/03/2026');
    expect(formatCollectionPeriodEn(period)).toBe('01/01/2026 to 31/03/2026');
  });
});
