import { AuthService } from './auth.service';
import {
  REGISTRATION_OVERDUE_DEFAULT_DAYS,
  isOverdue,
  overdueCutoff,
  overdueDaysFrom,
  waitingSince,
} from './registration-overdue';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

describe('registration overdue rule', () => {
  it('a pending file waits since registration, or since its last resubmission', () => {
    const registered = daysAgo(20);
    expect(waitingSince('PENDING_APPROVAL', registered, null)).toEqual(registered);
    const resubmitted = daysAgo(2);
    expect(waitingSince('PENDING_APPROVAL', registered, resubmitted)).toEqual(resubmitted);
  });

  it('a file that is not the reviewers’ move never waits on them', () => {
    for (const status of ['COMPLEMENTS_REQUESTED', 'ACTIVE', 'REJECTED']) {
      expect(waitingSince(status, daysAgo(30), null)).toBeNull();
      expect(isOverdue(waitingSince(status, daysAgo(30), null), 7)).toBe(false);
    }
  });

  it('is overdue past the threshold, not before', () => {
    expect(isOverdue(daysAgo(8), 7)).toBe(true);
    expect(isOverdue(daysAgo(6), 7)).toBe(false);
    expect(isOverdue(daysAgo(8), 14)).toBe(false);
    // A file resubmitted yesterday is fresh again, however old it is.
    expect(isOverdue(waitingSince('PENDING_APPROVAL', daysAgo(40), daysAgo(1)), 7)).toBe(false);
  });

  it('falls back to the default when the stored setting is unusable', () => {
    expect(overdueDaysFrom(14)).toBe(14);
    for (const bad of [undefined, null, 0, 91, 2.5, '7']) {
      expect(overdueDaysFrom(bad)).toBe(REGISTRATION_OVERDUE_DEFAULT_DAYS);
    }
  });
});

describe('AuthService.listCompanyRegistrations — overdue view', () => {
  function makeService(settingDays = 7) {
    const prisma: any = {
      company: {
        count: jest.fn(async () => 0),
        findMany: jest.fn(async () => []),
      },
      auditLog: {
        // One company resubmitted two days ago, inside the overdue window.
        findMany: jest.fn(async ({ where }: any) =>
          where?.action === 'COMPANY_REGISTRATION_RESUBMITTED' && where?.createdAt ? [{ resourceId: 'u-fresh' }] : []),
      },
    };
    const systemSettings: any = { getSettings: jest.fn(async () => ({ registrationOverdueDays: settingDays })) };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, systemSettings);
    return { prisma, service };
  }

  it('asks for pending files registered before the cutoff and not resubmitted since', async () => {
    const { prisma, service } = makeService();
    const before = overdueCutoff(7).getTime();
    await service.listCompanyRegistrations({ role: 'SUPER_ADMIN' }, { overdue: true, status: 'ACTIVE' });
    const where = prisma.company.findMany.mock.calls[0][0].where;
    expect(where.user.status).toBe('PENDING_APPROVAL'); // replaces the requested status
    expect(where.user.id).toEqual({ notIn: ['u-fresh'] });
    expect(Math.abs(where.createdAt.lt.getTime() - before)).toBeLessThan(5000);
  });

  it('uses the threshold set in Paramètres and reports it', async () => {
    const { prisma, service } = makeService(21);
    const before = overdueCutoff(21).getTime();
    const r = await service.listCompanyRegistrations({ role: 'SUPER_ADMIN' }, { overdue: true });
    const where = prisma.company.findMany.mock.calls[0][0].where;
    expect(Math.abs(where.createdAt.lt.getTime() - before)).toBeLessThan(5000);
    expect(r.overdueDays).toBe(21);
  });

  it('keeps the territory scope for a territorial reviewer', async () => {
    const { prisma, service } = makeService();
    await service.listCompanyRegistrations({ role: 'REGIONAL_ADMIN', region: 'Littoral' }, { overdue: true });
    const where = prisma.company.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('Littoral');
  });

  it('reports an overdue count with the status counts', async () => {
    const { prisma, service } = makeService();
    prisma.company.count.mockImplementation(async ({ where }: any) => (where.createdAt?.lt ? 3 : 1));
    const r = await service.listCompanyRegistrations({ role: 'SUPER_ADMIN' }, {});
    expect(r.counts).toMatchObject({ overdue: 3 });
  });
});
