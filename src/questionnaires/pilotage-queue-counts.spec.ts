import { territoryWhere } from '../auth/territory';
import { loadQueueCounts, territorySql } from './pilotage-queue-counts';

describe('territorySql', () => {
  const sql = (scope: Record<string, unknown>) => {
    const query = territorySql(scope);
    return { text: query.sql, values: query.values };
  };

  it('restricts nothing only for a national reader', () => {
    expect(sql(territoryWhere({ role: 'SUPER_ADMIN' })).text).toBe('TRUE');
    expect(sql(territoryWhere({ role: 'CENTRAL_AGENT' })).text).toBe('TRUE');
  });

  it('matches nothing for an account without a territory or a known role', () => {
    for (const role of ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN', 'COMPANY', null]) {
      expect(sql(territoryWhere({ role })).text).toBe('FALSE');
    }
  });

  it('keeps a region and a department on their ids when the account has them', () => {
    expect(sql(territoryWhere({ role: 'REGIONAL_ADMIN', regionId: 'r1' }))).toEqual({ text: 's."regionId" = ?', values: ['r1'] });
    expect(sql(territoryWhere({ role: 'DIVISIONAL_ADMIN', departmentId: 'd1' }))).toEqual({ text: 's."departmentId" = ?', values: ['d1'] });
  });

  it('matches names without case, and a department only within its region', () => {
    expect(sql(territoryWhere({ role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' }))).toEqual({
      text: 'LOWER(s.region) = LOWER(?) AND LOWER(s.department) = LOWER(?)',
      values: ['Littoral', 'Wouri'],
    });
  });

  it('refuses a filter it cannot spell rather than reading it as no restriction', () => {
    expect(() => territorySql({ companyId: 'c1' })).toThrow(/Unknown territory filter/);
    expect(() => territorySql({ region: { contains: 'Lit' } })).toThrow(/Unknown territory filter/);
    expect(() => territorySql({ id: { in: ['a'] } })).toThrow(/Unknown territory filter/);
  });
});

describe('loadQueueCounts', () => {
  it('reads the view it is given, inside the territory', async () => {
    const $queryRaw = jest.fn(async (_query: any) => []);
    await loadQueueCounts({ $queryRaw } as any, { regionId: 'r1' }, 'completed', true);
    const [query] = $queryRaw.mock.calls[0];
    expect(query.sql).toContain(`IN ('APPROVED', 'REJECTED', 'SUPERSEDED')`);
    expect(query.sql).not.toContain('"archivedAt" IS NULL');
    expect(query.values).toEqual(['r1']);
  });
});
