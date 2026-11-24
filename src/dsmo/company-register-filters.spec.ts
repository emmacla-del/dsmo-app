import { DsmoService } from './dsmo.service';

// GET /companies (the establishment register): the entity type and the
// « Suspendu » status are filtered by the query itself, so the page rows,
// the total and the pager describe the same list (2026-11-03).

function makeService() {
  const company = {
    count: jest.fn(async () => 0),
    findMany: jest.fn(async () => []),
  };
  const service = new DsmoService({ company } as any, {} as any, {} as any, {} as any);
  return { service, company };
}

const national = { role: 'SUPER_ADMIN' } as any;

describe('DsmoService.listCompanies register filters', () => {
  it('narrows by a known entity type, in any case', async () => {
    const { service, company } = makeService();
    await service.listCompanies({ entityType: 'cooperative' }, national);
    const where = (company.findMany.mock.calls[0] as any[])[0].where;
    expect(where.entityType).toBe('COOPERATIVE');
    expect((company.count.mock.calls[0] as any[])[0].where.entityType).toBe('COOPERATIVE');
  });

  it('ignores an unknown or retired entity type rather than emptying the list', async () => {
    const { service, company } = makeService();
    await service.listCompanies({ entityType: 'VOCATIONAL_TRAINING_CENTER' }, national);
    await service.listCompanies({ entityType: 'nope' }, national);
    for (const call of company.findMany.mock.calls as any[][]) expect(call[0].where.entityType).toBeUndefined();
  });

  it('reads « suspended » and « active » as approved accounts told apart by isActive', async () => {
    const { service, company } = makeService();
    await service.listCompanies({ status: 'SUSPENDED' }, national);
    await service.listCompanies({ status: 'ACTIVE' }, national);
    await service.listCompanies({ status: 'REJECTED' }, national);
    const accounts = (company.findMany.mock.calls as any[][]).map((call) => call[0].where.user.is);
    expect(accounts[0]).toMatchObject({ status: 'ACTIVE', isActive: false, archivedAt: null });
    expect(accounts[1]).toMatchObject({ status: 'ACTIVE', isActive: true });
    expect(accounts[2]).toEqual({ archivedAt: null, status: 'REJECTED' });
  });

  it('can scope the establishment register to every approved account', async () => {
    const { service, company } = makeService();
    await service.listCompanies({ registeredOnly: true }, national);
    await service.listCompanies({ registeredOnly: true, status: 'ACTIVE' }, national);
    await service.listCompanies({ registeredOnly: true, status: 'SUSPENDED' }, national);
    const accounts = (company.findMany.mock.calls as any[][]).map((call) => call[0].where.user.is);
    expect(accounts[0]).toEqual({ archivedAt: null, status: 'ACTIVE' });
    expect(accounts[1]).toEqual({ archivedAt: null, status: 'ACTIVE', isActive: true });
    expect(accounts[2]).toEqual({ archivedAt: null, status: 'ACTIVE', isActive: false });
  });

  it('includes archived approved owners only when explicitly requested', async () => {
    const { service, company } = makeService();
    await service.listCompanies({ registeredOnly: true, includeArchived: true }, national);
    expect((company.findMany.mock.calls[0] as any[])[0].where.user.is).toEqual({
      status: 'ACTIVE',
      OR: [{ archivedAt: null }, { archivedAt: { not: null } }],
    });
  });

  it('ANDs explicit territory filters with the caller scope', async () => {
    const { service, company } = makeService();
    await service.listCompanies(
      { region: 'Littoral', department: 'Wouri' },
      { role: 'REGIONAL_ADMIN', region: 'Centre' } as any,
    );
    const where = (company.findMany.mock.calls[0] as any[])[0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      { region: { equals: 'Centre', mode: 'insensitive' } },
      { region: { equals: 'Littoral', mode: 'insensitive' } },
      { department: { equals: 'Wouri', mode: 'insensitive' } },
    ]));
  });
});
