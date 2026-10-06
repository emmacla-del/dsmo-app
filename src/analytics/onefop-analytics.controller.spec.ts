import { OnefopAnalyticsController } from './onefop-analytics.controller';

// Walks every handler on the controller, so a handler added later without the
// territory scope fails here rather than shipping unscoped.
describe('OnefopAnalyticsController territory scope', () => {
  // getSectors takes no filter: national reference data (distinct sector names).
  const UNFILTERED = new Set(['constructor', 'getSectors']);
  // Breakdowns by region / department / subdivision (groupBy defaults to region).
  const BREAKDOWNS = new Set(['getEmployment', 'getEmploymentByLocation', 'getRecruitmentByLocation', 'getDeparturesByLocation']);

  const handlers = Object.getOwnPropertyNames(OnefopAnalyticsController.prototype).filter((name) => !UNFILTERED.has(name));

  const littoralScope = { region: { equals: 'Littoral', mode: 'insensitive' } };
  const noRows = { id: { in: [] } };

  // A facade whose every method records the filter it was given.
  function call(handler: string, user: Record<string, unknown>, query: Record<string, unknown>) {
    const calls: unknown[][] = [];
    const facade = new Proxy({}, { get: () => (...args: unknown[]) => { calls.push(args); return {}; } });
    const controller = new OnefopAnalyticsController(facade as any) as any;
    controller[handler](query, { user });
    expect(calls).toHaveLength(1);
    return calls[0][0] as Record<string, unknown>;
  }

  it('finds the handlers', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(44);
    for (const name of BREAKDOWNS) expect(handlers).toContain(name);
  });

  it.each(handlers)('%s carries a territory decision on its filter', (handler) => {
    expect(call(handler, { role: 'ADMIN_ONEFOP' }, {})).toHaveProperty('_territory');
  });

  it.each(handlers)('%s: a national role is never scoped', (handler) => {
    expect(call(handler, { role: 'ADMIN_ONEFOP' }, { region: 'Centre' })._territory).toBeUndefined();
    expect(call(handler, { role: 'SUPER_ADMIN' }, {})._territory).toBeUndefined();
  });

  it.each(handlers)('%s: a territorial admin reads national totals unless it is a breakdown', (handler) => {
    const filter = call(handler, { role: 'REGIONAL_ADMIN', region: 'Littoral' }, {});
    if (BREAKDOWNS.has(handler)) expect(filter._territory).toEqual(littoralScope);
    else expect(filter._territory).toBeUndefined();
  });

  it.each(handlers)('%s: a geographic filter from a territorial admin is ANDed with its territory', (handler) => {
    const filter = call(handler, { role: 'REGIONAL_ADMIN', region: 'Littoral' }, { region: 'Centre' });
    expect(filter._territory).toEqual(littoralScope);
    expect(filter.region).toBe('Centre');
  });

  it.each(handlers)('%s: an unassigned territorial admin fails closed', (handler) => {
    expect(call(handler, { role: 'DIVISIONAL_ADMIN', region: 'Littoral' }, {})._territory).toEqual(noRows);
  });

  it('cannot take the scope from the query string', () => {
    const filter = call('getDashboard', { role: 'REGIONAL_ADMIN', region: 'Littoral' }, { _territory: {}, region: 'Centre' });
    expect(filter._territory).toEqual(littoralScope);
  });
});
