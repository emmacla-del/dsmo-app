import { OnefopAnalyticsFacade } from './onefop-analytics.facade';

describe('OnefopAnalyticsFacade.getDashboard territory scope', () => {
  it('returns the empty dashboard for a fail-closed scope, without echoing the scope', async () => {
    const query = { resolveSubmissionIds: jest.fn(async () => []) };
    const facade = new OnefopAnalyticsFacade(query as any, ...(Array(8).fill({}) as [any, any, any, any, any, any, any, any]));
    const result = await facade.getDashboard({ region: 'Centre', _territory: { id: { in: [] } } });

    expect(query.resolveSubmissionIds).toHaveBeenCalledWith(expect.objectContaining({ _territory: { id: { in: [] } } }));
    expect(result.submissionCount).toBe(0);
    // The echoed filter is the request's own parameters; the Prisma fragment stays server-side.
    expect(result.filter).toEqual({ region: 'Centre' });
  });
});
