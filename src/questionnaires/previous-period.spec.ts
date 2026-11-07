import { pickPreviousPeriod } from './previous-period';
import { QuestionnairesService } from './questionnaires.service';

const at = (iso: string) => new Date(iso);

describe('pickPreviousPeriod', () => {
  const t2 = { id: 't2', quarterCode: 'QUARTERLY_2026_T2_001', submissionDate: at('2026-07-05T00:00:00Z') };
  const t3 = { id: 't3', quarterCode: 'QUARTERLY_2026_T3_001', submissionDate: at('2026-10-05T00:00:00Z') };
  const t4 = { id: 't4', quarterCode: 'QUARTERLY_2026_T4_001', submissionDate: at('2027-01-05T00:00:00Z') };

  it('takes the latest round that ended before this one', () => {
    expect(pickPreviousPeriod(t4, [t3, t2])).toBe('t3');
  });

  it('never takes a later round, even one filed first', () => {
    // A correction of T3, filed after T4 was endorsed.
    const correction = { quarterCode: t3.quarterCode, submissionDate: at('2027-02-01T00:00:00Z') };
    expect(pickPreviousPeriod(correction, [t4, t2])).toBe('t2');
  });

  it('reads the fallback code and the campaign code as the same calendar', () => {
    const legacy = { id: 'legacy', quarterCode: '2026-T2', submissionDate: t2.submissionDate };
    expect(pickPreviousPeriod(t3, [legacy])).toBe('legacy');
  });

  it('does not treat a second campaign of the same quarter as an earlier round', () => {
    const second = { quarterCode: 'QUARTERLY_2026_T3_002', submissionDate: at('2026-11-01T00:00:00Z') };
    expect(pickPreviousPeriod(second, [t3])).toBeNull();
  });

  it('prefers a readable earlier round to an unreadable code', () => {
    const noCode = { id: 'no-code', quarterCode: null, submissionDate: at('2026-09-01T00:00:00Z') };
    expect(pickPreviousPeriod(t3, [noCode, t2])).toBe('t2');
  });

  it('falls back to filing date when no round can be read', () => {
    const noCode = { id: 'no-code', quarterCode: null, submissionDate: at('2026-09-01T00:00:00Z') };
    expect(pickPreviousPeriod(t3, [noCode])).toBe('no-code');
    expect(pickPreviousPeriod({ quarterCode: null, submissionDate: at('2026-08-01T00:00:00Z') }, [t3, t2])).toBe('t2');
  });

  it('answers null when nothing is earlier', () => {
    expect(pickPreviousPeriod(t2, [t3, t4])).toBeNull();
    expect(pickPreviousPeriod(t2, [])).toBeNull();
  });
});

// The review workspace compares a file with the same establishment's last
// endorsed file for an earlier round (GET /admin/questionnaires/:id).
describe('QuestionnairesService.getById — previous period', () => {
  const file = {
    id: 'sub-2',
    submissionId: 'ONF-T3',
    establishmentId: 'est-1',
    formType: 'ENTREPRISE',
    quarterCode: '2026-T3',
    submissionDate: new Date('2026-10-19T00:00:00Z'),
    rawData: {},
  };
  const earlier = { id: 'sub-1', submissionId: 'ONF-T2', quarterCode: '2026-T2', rawData: { S1Q01: 12 } };
  const candidate = { id: 'sub-1', quarterCode: '2026-T2', submissionDate: new Date('2026-07-19T00:00:00Z') };
  const territory = { role: 'REGIONAL_ADMIN', region: 'Centre' } as any;

  it('returns the last endorsed earlier file of the same establishment and form', async () => {
    const findFirst = jest.fn().mockResolvedValueOnce(file).mockResolvedValueOnce(earlier);
    const findMany = jest.fn().mockResolvedValueOnce([candidate]);
    const service = new QuestionnairesService({ onefopSubmission: { findFirst, findMany }, onefopEnterpriseDetail: { findUnique: jest.fn().mockResolvedValue(null) }, onefopRespondent: { findUnique: jest.fn().mockResolvedValue(null) }, $queryRaw: jest.fn().mockResolvedValue([]) } as any);

    const result: any = await service.getById('sub-2', territory);

    expect(result.previousPeriod).toEqual({ id: 'sub-1', submissionId: 'ONF-T2', quarterCode: '2026-T2', rawData: { S1Q01: 12 } });
    const where = findMany.mock.calls[0][0].where.AND;
    expect(where).toEqual(expect.arrayContaining([
      { establishmentId: 'est-1' },
      { formType: 'ENTREPRISE' },
      { id: { not: 'sub-2' } },
      { status: 'APPROVED' },
      { region: { equals: 'Centre', mode: 'insensitive' } },
    ]));
    expect(findFirst.mock.calls[1][0].where).toEqual({ id: 'sub-1' });
  });

  it('returns null when there is no earlier endorsed file', async () => {
    const findFirst = jest.fn().mockResolvedValueOnce(file);
    const findMany = jest.fn().mockResolvedValueOnce([]);
    const service = new QuestionnairesService({ onefopSubmission: { findFirst, findMany }, onefopEnterpriseDetail: { findUnique: jest.fn().mockResolvedValue(null) }, onefopRespondent: { findUnique: jest.fn().mockResolvedValue(null) }, $queryRaw: jest.fn().mockResolvedValue([]) } as any);
    const result: any = await service.getById('sub-2', territory);
    expect(result.previousPeriod).toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
