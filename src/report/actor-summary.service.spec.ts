import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ActorSummaryService,
  coverageFor,
  median,
  parseNudgeBody,
  parsePeriod,
  periodStart,
} from './actor-summary.service';

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

function makeService(overrides: { users?: any[]; backlog?: any[]; fieldRows?: any[]; decisions?: any[]; lastDecision?: any } = {}) {
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
      groupBy: jest.fn(async () => []),
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
