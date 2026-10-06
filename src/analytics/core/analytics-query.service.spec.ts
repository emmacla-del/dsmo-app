import { AnalyticsQueryService } from './analytics-query.service';

// Where the territory fragment lands in the submission query.
describe('AnalyticsQueryService territory scope', () => {
  const littoralScope = { region: { equals: 'Littoral', mode: 'insensitive' } };
  const noRows = { id: { in: [] } };

  function makeService() {
    const prisma: any = {
      onefopSubmission: { findMany: jest.fn(async () => []) },
      onefopEnterpriseDetail: { findMany: jest.fn(async () => [{ submissionId: 's-1' }]) },
      onefopCooperativeDetail: { findMany: jest.fn(async () => []) },
      onefopCtdDetail: { findMany: jest.fn(async () => []) },
      onefopOngDetail: { findMany: jest.fn(async () => []) },
    };
    return { prisma, service: new AnalyticsQueryService(prisma) };
  }

  it('adds no AND for a national query', () => {
    const { service } = makeService();
    expect(service.buildSubmissionWhere({})).not.toHaveProperty('AND');
    expect(service.buildSubmissionWhere({ _territory: {} })).not.toHaveProperty('AND');
  });

  it('ANDs the territory next to the caller filter, so the filter can only narrow it', () => {
    const { service } = makeService();
    const where = service.buildSubmissionWhere({ region: 'Centre', _territory: littoralScope });
    expect(where.AND).toEqual([littoralScope]);
    // The caller's own filter is still there: Centre AND Littoral matches nothing.
    expect(where).toHaveProperty('region');
  });

  it('keeps the fail-closed scope when the sector filter overwrites where.id', async () => {
    const { service, prisma } = makeService();
    await service.resolveSubmissions({ sector: 'BTP', _territory: noRows });
    const { where } = prisma.onefopSubmission.findMany.mock.calls[0][0];
    expect(where.id).toEqual({ in: ['s-1'] });
    expect(where.AND).toEqual([noRows]);
  });
});
