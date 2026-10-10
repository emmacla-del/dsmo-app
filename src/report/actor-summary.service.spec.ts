import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ActorSummaryService,
  STALE_AFTER_DAYS,
  coverageFor,
  daysSince,
  latest,
  median,
  parseNudgeBody,
  parsePeriod,
  periodStart,
} from './actor-summary.service';
import { PilotageService } from '../pilotage/pilotage.service';

/**
 * Phase 4 (territorial admin monitoring). The properties worth pinning:
 * a regional admin's scope is applied in the query itself and fails closed,
 * a nudge only reaches an admin the caller may see, and a nudge never states
 * a number the data does not support.
 */

const NOW = new Date('2026-10-04T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const admin = {
  id: 'a1',
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@example.cm',
  role: 'REGIONAL_ADMIN',
  region: 'Littoral',
  department: null,
};

function makeService(
  overrides: { users?: any[]; backlog?: any[]; fieldRows?: any[]; decisions?: any[]; lastDecision?: any; lastActions?: any[] } = {},
) {
  const prisma = {
    user: {
      findMany: jest.fn(async (args: any) => {
        if (args.where?.assigneeId) return overrides.backlog ?? [];
        if (args.where?.createdBy) return overrides.fieldRows ?? [];
        if (args.where?.id?.in) return [];
        return overrides.users ?? [admin];
      }),
    },
    auditLog: {
      groupBy: jest.fn(async () => overrides.lastActions ?? []),
      findMany: jest.fn(async () => overrides.decisions ?? []),
      findFirst: jest.fn(async () => overrides.lastDecision ?? null),
    },
  } as any;
  const pilotage = {
    getCoverage: jest.fn(async () => ({
      regions: [
        {
          name: 'Littoral',
          registered: 34,
          inscriptionTarget: 100,
          rate: 0.34,
          departments: [{ name: 'Wouri', registered: 10, inscriptionTarget: 20, rate: 0.5 }],
        },
      ],
    })),
  } as any;
  const notifications = { create: jest.fn(async () => ({ id: 'n1' })) } as any;
  return { service: new ActorSummaryService(prisma, pilotage, notifications), prisma, notifications };
}

describe('parsePeriod', () => {
  it('defaults to 30d and accepts the four documented values', () => {
    expect(parsePeriod(undefined)).toBe('30d');
    for (const p of ['7d', '30d', '90d', '12m']) expect(parsePeriod(p)).toBe(p);
  });
  it('rejects anything else', () => {
    expect(() => parsePeriod('1y')).toThrow(BadRequestException);
  });
});

describe('periodStart', () => {
  it('counts days back, and months for 12m', () => {
    expect(periodStart('7d', NOW).getTime()).toBe(NOW.getTime() - 7 * DAY);
    expect(periodStart('12m', NOW).toISOString()).toBe('2025-10-04T10:00:00.000Z');
  });
});

describe('median', () => {
  it('is null for no data, the middle for odd, the mean of the middle two for even', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('latest / daysSince', () => {
  it('picks the latest timestamp and ignores missing ones', () => {
    expect(latest([])).toBeNull();
    expect(latest([null, new Date(NOW.getTime() - DAY), NOW, undefined])).toEqual(NOW);
  });

  it('counts whole days, never less than one', () => {
    expect(daysSince(new Date(NOW.getTime() - 12 * DAY - 1000), NOW)).toBe(12);
    expect(daysSince(new Date(NOW.getTime() - 60 * 1000), NOW)).toBe(1);
  });
});

describe('parseNudgeBody', () => {
  it('requires a userId and a known template', () => {
    expect(() => parseNudgeBody(null)).toThrow(BadRequestException);
    expect(() => parseNudgeBody({ template: 'STALE_BACKLOG' })).toThrow(BadRequestException);
    expect(() => parseNudgeBody({ userId: 'u', template: 'NOPE' })).toThrow(BadRequestException);
  });
  it('trims the custom message and caps its length', () => {
    expect(parseNudgeBody({ userId: 'u', template: 'STALE_BACKLOG', customMessage: '  ok  ' }).customMessage).toBe('ok');
    expect(parseNudgeBody({ userId: 'u', template: 'STALE_BACKLOG', customMessage: '  ' }).customMessage).toBeNull();
    expect(() =>
      parseNudgeBody({ userId: 'u', template: 'STALE_BACKLOG', customMessage: 'x'.repeat(501) }),
    ).toThrow(BadRequestException);
  });
});

describe('coverageFor', () => {
  const coverage = {
    year: 2026,
    regions: [
      {
        name: 'Littoral',
        registered: 34,
        inscriptionTarget: 100,
        rate: 0.34,
        departments: [{ name: 'Wouri', registered: 10, inscriptionTarget: 20, rate: 0.5 }],
      },
    ],
  };
  it('uses the region for a regional admin, case-insensitively', () => {
    expect(coverageFor({ role: 'REGIONAL_ADMIN', region: 'LITTORAL', department: null }, coverage)).toEqual({
      target: 100,
      current: 34,
      percent: 0.34,
    });
  });
  it('uses the department for a divisional admin', () => {
    expect(coverageFor({ role: 'DIVISIONAL_ADMIN', region: 'Littoral', department: 'Wouri' }, coverage).percent).toBe(0.5);
  });
  it('returns nulls, not zeros, when the ressort is unknown', () => {
    expect(coverageFor({ role: 'REGIONAL_ADMIN', region: 'Nulle part', department: null }, coverage)).toEqual({
      target: null,
      current: null,
      percent: null,
    });
  });
});

describe('ActorSummaryService.getActorSummary', () => {
  it('scopes a regional admin to its own region inside the query', async () => {
    const { service, prisma } = makeService();
    await service.getActorSummary({ id: 'r1', role: 'REGIONAL_ADMIN', region: 'Littoral' }, {}, NOW);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([{ region: { equals: 'Littoral', mode: 'insensitive' } }]);
    expect(where.role).toEqual({ in: ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN'] });
  });

  it('fails closed for a regional admin with no region', async () => {
    const { service, prisma } = makeService();
    const result = await service.getActorSummary({ id: 'r1', role: 'REGIONAL_ADMIN', region: null }, {}, NOW);
    expect(result.actors).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('does not scope a national role', async () => {
    const { service, prisma } = makeService();
    await service.getActorSummary({ id: 's1', role: 'SUPER_ADMIN' }, {}, NOW);
    expect(prisma.user.findMany.mock.calls[0][0].where.AND).toBeUndefined();
  });

  it('counts stale backlog and sorts the stalest first', async () => {
    const other = { ...admin, id: 'a2', firstName: 'Zoé', lastName: 'Z', email: 'z@example.cm' };
    const { service } = makeService({
      users: [other, admin],
      backlog: [
        { assigneeId: 'a1', createdAt: new Date(NOW.getTime() - 10 * DAY) },
        { assigneeId: 'a1', createdAt: new Date(NOW.getTime() - 1 * DAY) },
      ],
    });
    const result = await service.getActorSummary({ id: 's1', role: 'SUPER_ADMIN' }, {}, NOW);
    expect(result.actors.map((a) => a.userId)).toEqual(['a1', 'a2']);
    expect(result.actors[0].processing).toMatchObject({ backlog: 2, stale: 1 });
  });

  it('reports the last decision separately from the last action, and the stale threshold', async () => {
    const decided = new Date(NOW.getTime() - 9 * DAY);
    const browsed = new Date(NOW.getTime() - 1 * DAY);
    const { service, prisma } = makeService({
      lastActions: [
        { userId: 'a1', action: 'COMPANY_REGISTRATION_APPROVED', _max: { timestamp: decided } },
        { userId: 'a1', action: 'SEND_NOTIFICATION', _max: { timestamp: browsed } },
      ],
    });
    const result = await service.getActorSummary({ id: 's1', role: 'SUPER_ADMIN' }, {}, NOW);
    expect(prisma.auditLog.groupBy.mock.calls[0][0].by).toEqual(['userId', 'action']);
    expect(result.staleAfterDays).toBe(STALE_AFTER_DAYS);
    expect(result.actors[0].lastActionAt).toBe(browsed.toISOString());
    expect(result.actors[0].lastDecisionAt).toBe(decided.toISOString());
  });

  it('leaves lastDecisionAt null for an admin who never decided', async () => {
    const { service } = makeService({
      lastActions: [{ userId: 'a1', action: 'SEND_NOTIFICATION', _max: { timestamp: NOW } }],
    });
    const result = await service.getActorSummary({ id: 's1', role: 'SUPER_ADMIN' }, {}, NOW);
    expect(result.actors[0].lastDecisionAt).toBeNull();
  });

  it('rejects an unknown role filter', async () => {
    const { service } = makeService();
    await expect(service.getActorSummary({ id: 's1', role: 'SUPER_ADMIN' }, { role: 'COMPANY' }, NOW)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('ActorSummaryService.nudge', () => {
  const superAdmin = { id: 's1', role: 'SUPER_ADMIN' };

  it('answers not-found for an admin outside the caller scope', async () => {
    const { service, notifications } = makeService({ users: [] });
    await expect(service.nudge(superAdmin, { userId: 'x', template: 'NO_RECENT_ACTIVITY' }, NOW)).rejects.toThrow(
      NotFoundException,
    );
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('refuses a stale-backlog nudge when nothing is stale', async () => {
    const { service, notifications } = makeService();
    await expect(service.nudge(superAdmin, { userId: 'a1', template: 'STALE_BACKLOG' }, NOW)).rejects.toThrow(
      BadRequestException,
    );
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('sends a stale-backlog nudge with the real count and returns the notification id', async () => {
    const { service, notifications } = makeService({
      backlog: [{ assigneeId: 'a1', createdAt: new Date(NOW.getTime() - 9 * DAY) }],
    });
    const result = await service.nudge(
      superAdmin,
      { userId: 'a1', template: 'STALE_BACKLOG', customMessage: 'Merci' },
      NOW,
    );
    expect(result).toEqual({ id: 'n1' });
    const [userId, kind, , body, link] = notifications.create.mock.calls[0];
    expect(userId).toBe('a1');
    expect(kind).toBe('NUDGE');
    expect(body).toBe('Vous avez 1 dossier en attente depuis plus de 7 jours.\n\nMerci');
    expect(link).toBe('/admin/inscriptions');
  });

  it('states the real coverage percentage', async () => {
    const { service, notifications } = makeService();
    await service.nudge(superAdmin, { userId: 'a1', template: 'BEHIND_TARGET' }, NOW);
    expect(notifications.create.mock.calls[0][3]).toBe('Votre région est à 34% de la cible 2026.');
  });

  it('counts days since the last decision', async () => {
    const { service, notifications } = makeService({ lastDecision: { timestamp: new Date(NOW.getTime() - 12 * DAY) } });
    await service.nudge(superAdmin, { userId: 'a1', template: 'NO_RECENT_ACTIVITY' }, NOW);
    expect(notifications.create.mock.calls[0][3]).toBe('Aucune décision enregistrée sur votre compte depuis 12 jours.');
  });
});

// The pooler runs in session mode with a tenant pool of 15 and Prisma opens
// one connection per concurrent query, so the request must not fan out wide
// (EMAXCONNSESSION). These pin the whole request — loadMonitoredUsers,
// summarize, the reused PilotageService.getCoverage and the registrant read —
// to at most three queries in flight, and the response to the exact shape,
// numbers and order it had before the queries were sequenced.
describe('ActorSummaryService — connection budget', () => {
  const regional = { ...admin };
  const divisional = {
    id: 'a2',
    firstName: null,
    lastName: null,
    email: 'div@example.cm',
    role: 'DIVISIONAL_ADMIN',
    region: 'Littoral',
    department: 'Wouri',
  };
  const quiet = { ...admin, id: 'a3', firstName: 'Ana', lastName: 'B', region: 'Centre' };
  const at = (days: number) => new Date(NOW.getTime() - days * DAY);

  /** Every query is routed to its fixture and delayed by `delay(name)` ms. */
  function makeFakePrisma(delay: (name: string) => number) {
    let inFlight = 0;
    const stats = { peak: 0, calls: [] as string[] };
    const q =
      (name: string, answer: (args: any) => unknown) =>
      jest.fn(async (args: any) => {
        stats.calls.push(name);
        inFlight += 1;
        stats.peak = Math.max(stats.peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, delay(name)));
        inFlight -= 1;
        return answer(args);
      });
    const prisma = {
      user: {
        findMany: q('user.findMany', (args) => {
          if (args.where?.assigneeId) {
            return [
              { assigneeId: 'a1', createdAt: at(10) },
              { assigneeId: 'a1', createdAt: at(2) },
              { assigneeId: 'a2', createdAt: at(8) },
            ];
          }
          if (args.where?.createdBy) {
            return [
              { createdBy: 'a1', createdAt: at(5), _count: { onefopSubmissions: 1 } },
              { createdBy: 'a1', createdAt: at(3), _count: { onefopSubmissions: 0 } },
              { createdBy: 'a2', createdAt: at(1), _count: { onefopSubmissions: 2 } },
            ];
          }
          if (args.where?.id?.in) {
            return [
              { id: 'c1', createdAt: at(20) },
              { id: 'c2', createdAt: at(6) },
            ];
          }
          return [quiet, divisional, regional];
        }),
      },
      auditLog: {
        groupBy: q('auditLog.groupBy', () => [
          { userId: 'a1', action: 'COMPANY_REGISTRATION_APPROVED', _max: { timestamp: at(4) } },
          { userId: 'a1', action: 'SEND_NOTIFICATION', _max: { timestamp: at(1) } },
          { userId: 'a2', action: 'AUDIT_CORRECTION', _max: { timestamp: at(2) } },
        ]),
        findMany: q('auditLog.findMany', () => [
          { userId: 'a1', action: 'COMPANY_REGISTRATION_APPROVED', resourceType: 'User', resourceId: 'c1', timestamp: at(4) },
          { userId: 'a1', action: 'COMPANY_REGISTRATION_REJECTED', resourceType: 'User', resourceId: 'c2', timestamp: at(5) },
          { userId: 'a1', action: 'AUDIT_APPROVE', resourceType: 'OnefopSubmission', resourceId: 's1', timestamp: at(6) },
          { userId: 'a2', action: 'AUDIT_CORRECTION', resourceType: 'User', resourceId: 'c2', timestamp: at(2) },
        ]),
        findFirst: q('auditLog.findFirst', () => null),
      },
      region: {
        findMany: q('region.findMany', () => [
          { id: 'r-ce', name: 'Centre', departments: [] },
          {
            id: 'r-lt',
            name: 'Littoral',
            departments: [{ id: 'd-wouri', name: 'Wouri' }],
          },
        ]),
      },
      dataCampaign: { findMany: q('dataCampaign.findMany', () => [{ id: 'camp-1' }]) },
      campaignQuota: {
        findMany: q('campaignQuota.findMany', (args) =>
          args.where.scopeKind === 'ADMINISTRATION'
            ? [{ submissionTarget: 5 }]
            : [{ regionId: 'r-lt', departmentId: 'd-wouri', submissionTarget: 4 }],
        ),
      },
      company: {
        findMany: q('company.findMany', () => [
          {
            entityType: 'ENTREPRISE',
            regionId: 'r-lt',
            departmentId: 'd-wouri',
            establishmentId: 'E1',
            establishmentIdGeneratedAt: at(30),
            createdAt: at(40),
            departmentRef: { regionId: 'r-lt' },
            user: { status: 'ACTIVE', isActive: true, approvedAt: at(30) },
          },
        ]),
      },
    };
    return { prisma, stats };
  }

  function build(delay: (name: string) => number) {
    const { prisma, stats } = makeFakePrisma(delay);
    const pilotage = new PilotageService(prisma as any);
    const notifications = { create: jest.fn(async () => ({ id: 'n1' })) } as any;
    return { service: new ActorSummaryService(prisma as any, pilotage, notifications), stats, prisma };
  }

  // Uniform, coverage-slow and coverage-fast timings: the last is the one
  // where the old single Promise.all let getCoverage's own pair overlap the
  // four summary queries (six in flight).
  const profiles: Array<[string, (name: string) => number]> = [
    ['uniform', () => 5],
    ['coverage slow', (name) => (/region|dataCampaign|campaignQuota|company/.test(name) ? 20 : 2)],
    ['coverage fast', (name) => (/region|dataCampaign|campaignQuota|company/.test(name) ? 1 : 40)],
  ];

  it.each(profiles)('never has more than three queries in flight (%s timings)', async (_label, delay) => {
    const { service, stats } = build(delay);
    await service.getActorSummary({ id: 's1', role: 'SUPER_ADMIN' }, {}, NOW);
    expect(stats.peak).toBeLessThanOrEqual(3);
  });

  it('keeps a nudge within the same budget', async () => {
    const { service, stats } = build(profiles[2][1]);
    await service.nudge({ id: 's1', role: 'SUPER_ADMIN' }, { userId: 'a1', template: 'NO_RECENT_ACTIVITY' }, NOW);
    expect(stats.peak).toBeLessThanOrEqual(3);
  });

  it('returns exactly the same summary for a representative fixture', async () => {
    const { service, prisma } = build(() => 1);
    const result = await service.getActorSummary({ id: 's1', role: 'SUPER_ADMIN' }, { period: '30d' }, NOW);
    const actor = (
      userId: string,
      displayName: string,
      role: string,
      region: string,
      department: string | null,
      rest: object,
    ) => ({ userId, displayName, role, region, department, ...rest });
    // Recorded from the single-Promise.all implementation before the change.
    expect(result).toEqual({
      periodStart: '2026-09-04T10:00:00.000Z',
      periodEnd: '2026-10-04T10:00:00.000Z',
      staleAfterDays: 7,
      actors: [
        actor('a1', 'Jean Dupont', 'REGIONAL_ADMIN', 'Littoral', null, {
          lastActionAt: '2026-10-03T10:00:00.000Z',
          lastDecisionAt: '2026-09-30T10:00:00.000Z',
          field: { registrationsMade: 2, conversions: 1, conversionRate: 0.5, lastRegistrationAt: '2026-10-01T10:00:00.000Z' },
          coverage: { target: 4, current: 1, percent: 0.25 },
          processing: {
            backlog: 2,
            stale: 1,
            decisions: { approved: 2, rejected: 1, corrections: 0 },
            medianDaysToDecision: 8.5,
          },
        }),
        actor('a2', 'div@example.cm', 'DIVISIONAL_ADMIN', 'Littoral', 'Wouri', {
          lastActionAt: '2026-10-02T10:00:00.000Z',
          lastDecisionAt: '2026-10-02T10:00:00.000Z',
          field: { registrationsMade: 1, conversions: 1, conversionRate: 1, lastRegistrationAt: '2026-10-03T10:00:00.000Z' },
          coverage: { target: 4, current: 1, percent: 0.25 },
          processing: {
            backlog: 1,
            stale: 1,
            decisions: { approved: 0, rejected: 0, corrections: 1 },
            medianDaysToDecision: 4,
          },
        }),
        actor('a3', 'Ana B', 'REGIONAL_ADMIN', 'Centre', null, {
          lastActionAt: null,
          lastDecisionAt: null,
          field: { registrationsMade: 0, conversions: 0, conversionRate: null, lastRegistrationAt: null },
          coverage: { target: null, current: 0, percent: null },
          processing: {
            backlog: 0,
            stale: 0,
            decisions: { approved: 0, rejected: 0, corrections: 0 },
            medianDaysToDecision: null,
          },
        }),
      ],
    });

    // The same filters as before: every per-admin read is keyed by the
    // monitored ids, and coverage is still the one national read.
    const ids = ['a3', 'a2', 'a1'];
    const userWheres = prisma.user.findMany.mock.calls.map((call: any[]) => call[0].where);
    expect(userWheres).toContainEqual({ assigneeId: { in: ids }, status: { in: ['PENDING_APPROVAL', 'UNDER_REVIEW'] } });
    expect(userWheres).toContainEqual({
      createdBy: { in: ids },
      registrationMethod: 'ASSISTED',
      createdAt: { gte: new Date('2026-09-04T10:00:00.000Z'), lte: NOW },
    });
    expect(userWheres).toContainEqual({ id: { in: ['c1', 'c2'] } });
    expect(prisma.auditLog.groupBy.mock.calls[0][0].where).toEqual({ userId: { in: ids } });
    expect(prisma.auditLog.findMany.mock.calls[0][0].where.userId).toEqual({ in: ids });
    expect(prisma.region.findMany.mock.calls[0][0].where).toBeUndefined();
    expect(prisma.company.findMany.mock.calls[0][0].where).toEqual({});
  });
});
