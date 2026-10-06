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

// region=Nord used to be a substring match that also summed Nord-Ouest and
// Extrême-Nord. A figures-changing fix, logged for the ONEFOP domain owner.
describe('AnalyticsQueryService territory filters', () => {
  const service = new AnalyticsQueryService({} as any);

  it.each(['region', 'department', 'subdivision'] as const)('matches %s exactly, case-insensitively', (key) => {
    const where = service.buildSubmissionWhere({ [key]: 'Nord' });
    expect(where[key]).toEqual({ equals: 'Nord', mode: 'insensitive' });
  });

  it('trims the value, and treats a blank one as no filter', () => {
    expect(service.buildSubmissionWhere({ region: '  Ouest ' }).region).toEqual({ equals: 'Ouest', mode: 'insensitive' });
    expect(service.buildSubmissionWhere({ region: '   ' })).not.toHaveProperty('region');
  });

  it('ignores a repeated parameter instead of passing an array to Prisma', () => {
    const where = service.buildSubmissionWhere({ region: ['Nord', 'Sud'] as unknown as string });
    expect(where).not.toHaveProperty('region');
  });
});
