import { OnefopService } from './onefop.service';

/**
 * GET /onefop/active-quarter (F7, 2026-10-10). With no ONEFOP round at all,
 * the period used to be reported open although every final filing is
 * refused without a round: respondents filled the whole form and only
 * learned at the last click that it could not be filed.
 */
describe('OnefopService.getActiveQuarter', () => {
  const build = (openRound: unknown, latestRound: unknown) => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce(openRound) // the genuinely open round
      .mockResolvedValueOnce(latestRound); // the most recent one, any status
    const service = new OnefopService({ submissionRound: { findFirst } } as any, {} as any);
    return { service, findFirst };
  };

  it('with no round at all, the current quarter is reported closed, with a code drafts can keep using', async () => {
    const { service } = build(null, null);
    const q = await service.getActiveQuarter();
    expect(q.isOpen).toBe(false);
    expect(q.code).toMatch(/^\d{4}-T[1-4]$/);
    expect((q as any).message).toMatch(/Aucune campagne de collecte ONEFOP n'est encore ouverte/);
    expect(q.label).not.toMatch(/test/i);
  });

  it('an open round is reported open under its own code', async () => {
    const round = {
      id: 'r1', quarterCode: 'QUARTERLY_2026_T4_001', labelFr: 'T4 2026',
      deadline: new Date(Date.now() + 86_400_000), periodStart: new Date(), periodEnd: new Date(),
    };
    const { service } = build(round, round);
    const q = await service.getActiveQuarter();
    expect(q).toMatchObject({ isOpen: true, code: 'QUARTERLY_2026_T4_001' });
  });

  it('a latest round past its deadline names its closing day in Cameroon (Africa/Douala)', async () => {
    // Midnight Douala on 31 Dec 2025 is 23:00 UTC on 30 Dec; a UTC server
    // printed 30/12/2025.
    const latest = {
      id: 'r0', quarterCode: 'QUARTERLY_2025_T4_001', labelFr: 'T4 2025',
      deadline: new Date('2025-12-30T23:00:00.000Z'), periodStart: new Date(), periodEnd: new Date(),
    };
    const { service } = build(null, latest);
    const q = await service.getActiveQuarter();
    expect(q.isOpen).toBe(false);
    expect((q as any).message).toBe('La période de collecte « T4 2025 » est close depuis le 31/12/2025.');
  });
});
