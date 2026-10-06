import { OnefopService } from './onefop.service';

/**
 * GET /onefop/submissions scoping (gap report 3c). The list used to fall
 * through to an unfiltered national query for a territorial admin with no
 * assignment, and ignored the `region` query parameter.
 */
describe('OnefopService.getSubmissions territory scope', () => {
  const NO_ROWS = { id: { in: [] } };

  let prisma: any;
  let service: OnefopService;

  const lastWhere = () => prisma.onefopSubmission.findMany.mock.calls[0][0].where;

  beforeEach(() => {
    prisma = {
      company: { findFirst: jest.fn(async () => ({ id: 'c1' })) },
      onefopSubmission: { findMany: jest.fn(async () => []) },
    };
    service = new OnefopService(prisma, {} as any);
  });

  it('REGIONAL_ADMIN without a region gets an empty list, never a national query', async () => {
    const result = await service.getSubmissions({ id: 'u1', role: 'REGIONAL_ADMIN', region: null }, {});
    expect(result).toEqual([]);
    expect(lastWhere()).toMatchObject(NO_ROWS);
    expect(lastWhere()).not.toHaveProperty('region');
  });

  it('REGIONAL_ADMIN with a blank region fails closed', async () => {
    await service.getSubmissions({ id: 'u1', role: 'REGIONAL_ADMIN', region: '   ' }, {});
    expect(lastWhere()).toMatchObject(NO_ROWS);
  });

  it('DIVISIONAL_ADMIN without a department gets an empty list', async () => {
    const result = await service.getSubmissions(
      { id: 'u1', role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: null },
      {},
    );
    expect(result).toEqual([]);
    expect(lastWhere()).toMatchObject(NO_ROWS);
  });

  it('REGIONAL_ADMIN with a region is scoped to it, case-insensitively', async () => {
    await service.getSubmissions({ id: 'u1', role: 'REGIONAL_ADMIN', region: 'Littoral' }, {});
    expect(lastWhere()).toEqual({ region: { equals: 'Littoral', mode: 'insensitive' } });
  });

  it('DIVISIONAL_ADMIN is scoped to region AND department', async () => {
    await service.getSubmissions(
      { id: 'u1', role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' },
      {},
    );
    expect(lastWhere()).toEqual({
      region: { equals: 'Littoral', mode: 'insensitive' },
      department: { equals: 'Wouri', mode: 'insensitive' },
    });
  });

  it('the region query parameter narrows within the caller scope', async () => {
    await service.getSubmissions(
      { id: 'u1', role: 'REGIONAL_ADMIN', region: 'Littoral' },
      { region: 'Centre' },
    );
    // Both conditions must hold, so another region yields no rows rather
    // than widening the caller's scope.
    expect(lastWhere()).toEqual({
      region: { equals: 'Littoral', mode: 'insensitive' },
      AND: [{ region: { equals: 'Centre', mode: 'insensitive' } }],
    });
  });

  it('the region query parameter does not lift the fail-closed scope', async () => {
    await service.getSubmissions({ id: 'u1', role: 'REGIONAL_ADMIN', region: null }, { region: 'Centre' });
    expect(lastWhere()).toMatchObject(NO_ROWS);
  });

  it.each(['SUPER_ADMIN', 'ADMIN_ONEFOP'])('%s keeps national scope', async (role) => {
    await service.getSubmissions({ id: 'u1', role }, { status: 'PENDING_REVIEW' });
    expect(lastWhere()).toEqual({ status: 'PENDING_REVIEW' });
  });

  it('a national role can narrow by region', async () => {
    await service.getSubmissions({ id: 'u1', role: 'ADMIN_ONEFOP' }, { region: 'Centre' });
    expect(lastWhere()).toEqual({ AND: [{ region: { equals: 'Centre', mode: 'insensitive' } }] });
  });

  it('COMPANY keeps its own-company scope', async () => {
    await service.getSubmissions({ id: 'u-co', role: 'COMPANY' }, {});
    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { userId: 'u-co' } });
    expect(lastWhere()).toEqual({ companyId: 'c1' });
  });

  it('COMPANY without a company profile gets an empty list without querying', async () => {
    prisma.company.findFirst.mockResolvedValueOnce(null);
    expect(await service.getSubmissions({ id: 'u-co', role: 'COMPANY' }, {})).toEqual([]);
    expect(prisma.onefopSubmission.findMany).not.toHaveBeenCalled();
  });

  it('an unknown role fails closed', async () => {
    await service.getSubmissions({ id: 'u1', role: 'AUDITOR' }, {});
    expect(lastWhere()).toMatchObject(NO_ROWS);
  });
});
