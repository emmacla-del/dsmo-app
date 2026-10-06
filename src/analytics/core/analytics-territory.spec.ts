import { analyticsTerritoryScope } from './analytics-territory';

// The "national, no breakdowns" rule for ONEFOP analytics (ruled 2026-10-06).
describe('analyticsTerritoryScope', () => {
  const littoral = { role: 'REGIONAL_ADMIN', region: 'Littoral' };
  const wouri = { role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' };
  const littoralScope = { region: { equals: 'Littoral', mode: 'insensitive' } };
  const wouriScope = {
    region: { equals: 'Littoral', mode: 'insensitive' },
    department: { equals: 'Wouri', mode: 'insensitive' },
  };
  const noRows = { id: { in: [] } };

  it.each(['SUPER_ADMIN', 'ADMIN_ONEFOP'])('never restricts %s, filter or breakdown', (role) => {
    expect(analyticsTerritoryScope({ role }, {})).toBeUndefined();
    expect(analyticsTerritoryScope({ role }, { region: 'Centre' })).toBeUndefined();
    expect(analyticsTerritoryScope({ role }, {}, { geographicBreakdown: true })).toBeUndefined();
  });

  it('lets a territorial admin read national totals when it sends no geographic filter', () => {
    expect(analyticsTerritoryScope(littoral, {})).toBeUndefined();
    expect(analyticsTerritoryScope(littoral, { year: '2026', sector: 'BTP', entityType: 'ENTREPRISE' })).toBeUndefined();
    expect(analyticsTerritoryScope(wouri, undefined)).toBeUndefined();
  });

  it.each(['region', 'department', 'subdivision'])('scopes a territorial admin that filters by %s', (key) => {
    expect(analyticsTerritoryScope(littoral, { [key]: 'Centre' })).toEqual(littoralScope);
    expect(analyticsTerritoryScope(wouri, { [key]: 'Mfoundi' })).toEqual(wouriScope);
  });

  it('scopes its own region too: the filter can only narrow inside the territory', () => {
    expect(analyticsTerritoryScope(littoral, { region: 'Littoral', department: 'Wouri' })).toEqual(littoralScope);
  });

  it('scopes a geographic breakdown even with no filter', () => {
    expect(analyticsTerritoryScope(littoral, {}, { geographicBreakdown: true })).toEqual(littoralScope);
    expect(analyticsTerritoryScope(wouri, { groupBy: 'subdivision' }, { geographicBreakdown: true })).toEqual(wouriScope);
  });

  it('counts an array filter as a filter, and a blank one as none', () => {
    expect(analyticsTerritoryScope(littoral, { region: ['Centre', 'Sud'] })).toEqual(littoralScope);
    expect(analyticsTerritoryScope(littoral, { region: '  ' })).toBeUndefined();
    expect(analyticsTerritoryScope(littoral, { region: [] })).toBeUndefined();
  });

  it('fails closed on every request for an unresolvable territory, filter or not', () => {
    for (const user of [
      { role: 'REGIONAL_ADMIN', region: '' },
      { role: 'DIVISIONAL_ADMIN', region: 'Littoral' },
      { role: 'COMPANY' },
      {},
      undefined,
    ]) {
      expect(analyticsTerritoryScope(user, {})).toEqual(noRows);
      expect(analyticsTerritoryScope(user, { region: 'Littoral' })).toEqual(noRows);
    }
  });
});
