import { ClaimLapsesController } from './claim-lapses.controller';
import { countClaimLapses } from './claim-lapses';

/**
 * The negative signal for a missed claim deadline (CLAUDE.md §21,
 * 2026-11-09): counted from the release audit rows, by officer and kind.
 */
describe('claim lapses', () => {
  const groupRows = [
    { userId: 'u1', action: 'REGISTRATION_CLAIM_EXPIRED', _count: { _all: 3 } },
    { userId: 'u1', action: 'DOSSIER_CLAIM_EXPIRED', _count: { _all: 1 } },
    { userId: 'stranger', action: 'DOSSIER_CLAIM_EXPIRED', _count: { _all: 9 } },
  ];

  it('counts each officer\'s deadline lapses by kind, zero for an officer with none', async () => {
    const prisma = { auditLog: { groupBy: jest.fn(async () => groupRows) } };
    const start = new Date('2026-10-10T00:00:00Z');
    const end = new Date('2026-11-09T00:00:00Z');
    const counts = await countClaimLapses(prisma, ['u1', 'u2'], start, end);
    expect(counts.get('u1')).toEqual({ registrations: 3, submissions: 1 });
    expect(counts.get('u2')).toEqual({ registrations: 0, submissions: 0 });
    // A row for someone not asked about is ignored, not added.
    expect(counts.has('stranger')).toBe(false);
    expect((prisma.auditLog.groupBy.mock.calls[0] as any[])[0].where).toEqual({
      userId: { in: ['u1', 'u2'] },
      action: { in: ['REGISTRATION_CLAIM_EXPIRED', 'DOSSIER_CLAIM_EXPIRED'] },
      timestamp: { gte: start, lte: end },
      details: { path: ['reason'], equals: 'DEADLINE' },
    });
  });

  it('reads nothing for no officer', async () => {
    const prisma = { auditLog: { groupBy: jest.fn() } };
    expect((await countClaimLapses(prisma as any, [], new Date(), new Date())).size).toBe(0);
    expect(prisma.auditLog.groupBy).not.toHaveBeenCalled();
  });

  it('answers the caller about themselves only, over the last 30 days', async () => {
    const prisma = { auditLog: { groupBy: jest.fn(async () => groupRows) } };
    const controller = new ClaimLapsesController(prisma as any);
    const result = await controller.ownLapses({ user: { id: 'u1' } });
    expect(result).toMatchObject({ days: 30, registrations: 3, submissions: 1 });
    const where = (prisma.auditLog.groupBy.mock.calls[0] as any[])[0].where;
    expect(where.userId).toEqual({ in: ['u1'] });
    expect(new Date(result.until).getTime() - new Date(result.since).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
