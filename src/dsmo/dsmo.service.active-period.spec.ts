import { DsmoService } from './dsmo.service';

/**
 * GET /dsmo/active-period — DSMO mirror of the F7 fix (2026-10-10) to
 * GET /onefop/active-quarter. With no DSMO round at all, the period used to
 * be reported open, labelled « (Période test) ».
 */
describe('DsmoService.getActivePeriod', () => {
  const build = (openRound: unknown, latestRound: unknown) => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce(openRound) // the genuinely open round
      .mockResolvedValueOnce(latestRound); // the most recent one, any status
    const service = new DsmoService(
      { submissionRound: { findFirst } } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, findFirst };
  };

  it('with no round at all, the current quarter is reported closed, with a code that stays usable', async () => {
    const { service } = build(null, null);
    const p = await service.getActivePeriod();
    expect(p.isOpen).toBe(false);
    expect(p.code).toMatch(/^\d{4}-T[1-4]$/);
    expect((p as any).message).toMatch(/Aucune campagne de collecte DSMO n'est encore ouverte/);
    expect(p.label).not.toMatch(/test/i);
  });

  it('an open round is reported open under its own code', async () => {
    const round = {
      id: 'r1', quarterCode: 'QUARTERLY_2026_T4_001', labelFr: 'T4 2026',
      deadline: new Date(Date.now() + 86_400_000),
    };
    const { service, findFirst } = build(round, round);
    const p = await service.getActivePeriod();
    expect(p).toMatchObject({ isOpen: true, code: 'QUARTERLY_2026_T4_001', label: 'T4 2026' });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(p).not.toHaveProperty('message');
  });

  it('a latest round past its deadline is reported closed, naming the period and its closing date', async () => {
    // Midnight Douala on 31 Dec 2025 is 23:00 UTC on 30 Dec: the message names
    // the Cameroon day, 31/12/2025, whatever zone the server runs in.
    const deadline = new Date('2025-12-30T23:00:00.000Z');
    const latest = {
      id: 'r0', quarterCode: 'QUARTERLY_2026_T3_001', labelFr: 'T3 2026',
      status: 'OPEN', deadline,
    };
    const { service } = build(null, latest);
    const p = await service.getActivePeriod();
    expect(p).toMatchObject({ isOpen: false, code: 'QUARTERLY_2026_T3_001', label: 'T3 2026', deadline });
    expect((p as any).message).toBe(
      'La période de collecte « T3 2026 » est close depuis le 31/12/2025.',
    );
  });

  it('a latest round CLOSED before its deadline is reported closed, not open to submissions', async () => {
    const latest = {
      id: 'r0', quarterCode: 'QUARTERLY_2026_T4_001', labelFr: 'T4 2026',
      status: 'CLOSED', deadline: new Date(Date.now() + 86_400_000),
    };
    const { service } = build(null, latest);
    const p = await service.getActivePeriod();
    expect(p.isOpen).toBe(false);
    expect((p as any).message).toBe("La période de collecte « T4 2026 » n'est pas ouverte aux soumissions.");
  });
});
