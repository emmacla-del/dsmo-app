import { OnefopAnalyticsService } from './onefop-analytics.service';

// The legacy service behind /reports/* (ADMIN_ONEFOP / SUPER_ADMIN only).
// region=Nord used to be a substring match that also summed Nord-Ouest and
// Extrême-Nord. A figures-changing fix, logged for the ONEFOP domain owner.
describe('OnefopAnalyticsService territory filters', () => {
  const where = (filter: Record<string, unknown>) =>
    (new OnefopAnalyticsService({} as any) as any).buildSubmissionWhere(filter);

  it.each(['region', 'department', 'subdivision'])('matches %s exactly, case-insensitively', (key) => {
    expect(where({ [key]: 'Nord' })[key]).toEqual({ equals: 'Nord', mode: 'insensitive' });
  });

  it('trims the value, and treats a blank one as no filter', () => {
    expect(where({ region: ' Ouest  ' }).region).toEqual({ equals: 'Ouest', mode: 'insensitive' });
    expect(where({ region: '  ' })).not.toHaveProperty('region');
  });

  it('ignores a repeated parameter instead of passing an array to Prisma', () => {
    expect(where({ region: ['Nord', 'Sud'] })).not.toHaveProperty('region');
  });
});
