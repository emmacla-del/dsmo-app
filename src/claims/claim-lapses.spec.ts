import { ClaimLapsesController } from './claim-lapses.controller';
import { claimSignalFrom, countClaimLapses } from './claim-lapses';

/**
 * The negative signal for a missed claim deadline (CLAUDE.md §21,
 * 2026-11-09): counted from the release audit rows, by officer and kind,
 * for claims taken once the rule was in force.
 */
describe('claim lapses', () => {
  const FROM = new Date('2026-11-10T00:00:00.000Z');
  const lapse = (userId: string, action: string, claimedAt: string | null, timestamp = '2026-11-12T10:00:00.000Z') => ({
    userId,
    action,
    timestamp: new Date(timestamp),
    details: claimedAt ? { reason: 'DEADLINE', claimedAt } : { reason: 'DEADLINE' },
  });
  const rows = [
    lapse('u1', 'REGISTRATION_CLAIM_EXPIRED', '2026-11-12T07:00:00.000Z'),
    lapse('u1', 'REGISTRATION_CLAIM_EXPIRED', '2026-11-11T07:00:00.000Z'),
    lapse('u1', 'DOSSIER_CLAIM_EXPIRED', '2026-11-11T20:00:00.000Z'),
    lapse('stranger', 'DOSSIER_CLAIM_EXPIRED', '2026-11-11T20:00:00.000Z'),
  ];
  const start = new Date('2026-10-15T00:00:00Z');
  const end = new Date('2026-11-14T00:00:00Z');

  it('counts each officer\'s deadline lapses by kind, zero for an officer with none', async () => {
    const prisma = { auditLog: { findMany: jest.fn(async () => rows) } };
    const counts = await countClaimLapses(prisma, ['u1', 'u2'], start, end, FROM);
    expect(counts.get('u1')).toEqual({ registrations: 2, submissions: 1 });
    expect(counts.get('u2')).toEqual({ registrations: 0, submissions: 0 });
    // A row for someone not asked about is ignored, not added.
    expect(counts.has('stranger')).toBe(false);
    expect((prisma.auditLog.findMany.mock.calls[0] as any[])[0].where).toEqual({
      userId: { in: ['u1', 'u2'] },
      action: { in: ['REGISTRATION_CLAIM_EXPIRED', 'DOSSIER_CLAIM_EXPIRED'] },
      // Nothing released before the rule's start can count.
      timestamp: { gte: FROM, lte: end },
      details: { path: ['reason'], equals: 'DEADLINE' },
    });
  });

  it('does not hold against anyone a claim taken before the rule, released when it came in', async () => {
    // 2026-11-09 on the shared database: four claims from 1 and 8 November,
    // released by the first sweep, all with reason DEADLINE.
    const prisma = {
      auditLog: {
        findMany: jest.fn(async () => [
          lapse('u1', 'DOSSIER_CLAIM_EXPIRED', '2026-11-01T09:01:54.359Z', '2026-11-10T00:05:00.000Z'),
          lapse('u1', 'DOSSIER_CLAIM_EXPIRED', '2026-11-08T12:12:15.314Z', '2026-11-10T00:05:00.000Z'),
          lapse('u1', 'REGISTRATION_CLAIM_EXPIRED', '2026-11-10T08:00:00.000Z', '2026-11-10T10:05:00.000Z'),
        ]),
      },
    };
    const counts = await countClaimLapses(prisma, ['u1'], start, end, FROM);
    expect(counts.get('u1')).toEqual({ registrations: 1, submissions: 0 });
  });

  it('dates a row that records no claim time by its release', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn(async () => [
          lapse('u1', 'DOSSIER_CLAIM_EXPIRED', null, '2026-11-12T10:00:00.000Z'),
          lapse('u1', 'DOSSIER_CLAIM_EXPIRED', null, '2026-11-09T10:00:00.000Z'),
          // Not a lapse action: never counted, whatever the read returns.
          lapse('u1', 'AUDIT_APPROVE', '2026-11-12T07:00:00.000Z'),
        ]),
      },
    };
    expect((await countClaimLapses(prisma, ['u1'], start, end, FROM)).get('u1')).toEqual({ registrations: 0, submissions: 1 });
  });

  it('starts counting the day after approval unless the deployment time is configured', () => {
    expect(claimSignalFrom({}).toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(claimSignalFrom({ ONEFOP_CLAIM_SIGNAL_FROM: '2026-11-11T15:30:00Z' }).toISOString()).toBe('2026-11-11T15:30:00.000Z');
    expect(claimSignalFrom({ ONEFOP_CLAIM_SIGNAL_FROM: 'not a date' }).toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });

  it('reads nothing for no officer', async () => {
    const prisma = { auditLog: { findMany: jest.fn() } };
    expect((await countClaimLapses(prisma as any, [], start, end, FROM)).size).toBe(0);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('answers the caller about themselves only, over the last 30 days', async () => {
    const prisma = { auditLog: { findMany: jest.fn(async () => []) } };
    const controller = new ClaimLapsesController(prisma as any);
    const result = await controller.ownLapses({ user: { id: 'u1' } });
    expect(result).toMatchObject({ days: 30, registrations: 0, submissions: 0 });
    const where = (prisma.auditLog.findMany.mock.calls[0] as any[])[0].where;
    expect(where.userId).toEqual({ in: ['u1'] });
    expect(new Date(result.until).getTime() - new Date(result.since).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
