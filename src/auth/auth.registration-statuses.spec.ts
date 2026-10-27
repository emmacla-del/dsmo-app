import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserStatus } from '../types/prisma.types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const date = (day: number) => new Date(`2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`);

function companyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-1',
    name: 'Example Company',
    taxNumber: 'TAX-1',
    cnpsNumber: null,
    subdivisionId: null,
    entityType: 'ENTREPRISE',
    region: 'Territory A',
    department: 'Department A',
    createdAt: date(1),
    updatedAt: date(2),
    phone: null,
    respondentFirstName: null,
    respondentLastName: null,
    respondentFunction: null,
    respondentPhone: null,
    respondentPhone2: null,
    user: {
      id: 'user-1',
      email: 'user@example.cm',
      status: UserStatus.REJECTED,
      createdAt: date(1),
      approvedAt: null,
      approvedBy: null,
      rejectedAt: date(2),
      rejectedBy: 'reviewer-1',
      approvalComment: null,
      rejectionReason: 'Incomplete',
      registrationNumber: null,
      registrationMethod: 'SELF_SERVICE',
      createdBy: null,
      createdByUser: null,
    },
    ...overrides,
  };
}

function makeService(options: {
  total?: number;
  overdue?: number;
  rows?: any[];
  groups?: Array<{ status: UserStatus; _count: { _all: number } }>;
} = {}) {
  const total = options.total ?? 0;
  const overdue = options.overdue ?? 0;
  const rows = options.rows ?? [];
  const prisma: any = {
    company: {
      count: jest.fn(async ({ where }: any) => where?.user?.status === UserStatus.PENDING_APPROVAL ? overdue : total),
      findMany: jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]),
    },
    user: { groupBy: jest.fn(async () => options.groups ?? []) },
    auditLog: { findMany: jest.fn(async () => []) },
  };
  const service = new AuthService(
    prisma,
    {} as any,
    { sendRegistrationRejectedEmail: jest.fn(async () => undefined) } as any,
    {} as any,
    { getSettings: async () => ({ registrationOverdueDays: 7 }) } as any,
  );
  return { service, prisma };
}

const regionalActor = { role: 'REGIONAL_ADMIN', region: 'Territory A' };

describe('Phase 1 registrations statuses and counts contract', () => {
  it('R-1 applies the territory and uses one filtered query for total and page rows', async () => {
    const { service, prisma } = makeService({ total: 3 });
    const first = await service.listCompanyRegistrations(regionalActor, {
      statuses: 'ACTIVE,REJECTED', page: 1, pageSize: 2,
    });
    const second = await service.listCompanyRegistrations(regionalActor, {
      statuses: 'ACTIVE,REJECTED', page: 2, pageSize: 2,
    });
    const firstRowsQuery = prisma.company.findMany.mock.calls[0][0];
    expect(firstRowsQuery.where).toMatchObject({
      region: { equals: 'Territory A', mode: 'insensitive' },
      user: { role: 'COMPANY', status: { in: [UserStatus.ACTIVE, UserStatus.REJECTED] } },
    });
    expect(prisma.company.count.mock.calls[0][0].where).toEqual(firstRowsQuery.where);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    expect(firstRowsQuery.skip).toBe(0);
    expect(prisma.company.findMany.mock.calls[1][0].skip).toBe(2);
  });

  it('R-2 keeps ADMIN_ONEFOP_REGISTRATIONS national', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP_REGISTRATIONS' }, { statuses: 'ACTIVE,REJECTED' });
    expect(prisma.company.findMany.mock.calls[0][0].where).not.toHaveProperty('region');
    expect(prisma.company.findMany.mock.calls[0][0].where.user.status.in).toEqual([UserStatus.ACTIVE, UserStatus.REJECTED]);
  });

  it('R-3 allows CENTRAL_AGENT to read company registrations', async () => {
    const { service, prisma } = makeService();
    await expect(service.listCompanyRegistrations({ role: 'CENTRAL_AGENT' }, { statuses: 'ACTIVE,REJECTED' })).resolves.toBeDefined();
    expect(prisma.company.findMany.mock.calls[0][0].where).not.toHaveProperty('region');
    const roles = Reflect.getMetadata('roles', AuthController.prototype.listCompanyRegistrations) as string[];
    expect(roles).toContain('CENTRAL_AGENT');
  });

  it('R-4 restricts a pending status set to the regional actor territory', async () => {
    const { service, prisma } = makeService();
    await service.listCompanyRegistrations(regionalActor, { statuses: 'PENDING_APPROVAL' });
    expect(prisma.company.findMany.mock.calls[0][0].where).toMatchObject({
      region: { equals: 'Territory A', mode: 'insensitive' },
      user: { status: { in: [UserStatus.PENDING_APPROVAL] } },
    });
  });

  it('R-5 preserves status=ALL as an unfiltered status condition', async () => {
    const { service, prisma } = makeService();
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { status: 'ALL' });
    expect(prisma.company.findMany.mock.calls[0][0].where.user).toEqual({ role: 'COMPANY' });
    expect(result.countsView).toBe('all');
  });

  it('R-6 rejects OVERDUE in the stored status set with the overdue parameter hint', async () => {
    const { service } = makeService();
    await expect(service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { statuses: 'OVERDUE' }))
      .rejects.toThrow(/OVERDUE.*overdue=true/);
  });

  it('R-7 rejects status and statuses together', async () => {
    const { service } = makeService();
    await expect(service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { status: 'REJECTED', statuses: 'ACTIVE' }))
      .rejects.toThrow(/mutually exclusive/);
  });

  it('R-8 rejects an unknown status and names it', async () => {
    const { service } = makeService();
    await expect(service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { statuses: 'ACTIVE,BOGUS' }))
      .rejects.toThrow(/BOGUS/);
  });

  it('rejects an empty statuses set', async () => {
    const { service } = makeService();
    await expect(service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { statuses: ' , ' }))
      .rejects.toThrow(BadRequestException);
  });

  it('R-9 organisation counts match the ACTIVE and REJECTED list total', async () => {
    const { service } = makeService({
      total: 3,
      groups: [
        { status: UserStatus.ACTIVE, _count: { _all: 2 } },
        { status: UserStatus.REJECTED, _count: { _all: 1 } },
      ],
    });
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {
      statuses: 'ACTIVE,REJECTED', view: 'organisations',
    });
    expect(result.countsView).toBe('organisations');
    expect(result.counts.approved + result.counts.rejected).toBe(result.total);
    expect(result.counts.pending).toBe(0);
    expect(result.counts.overdue).toBe(0);
  });

  it('R-10 queue counts match the queue list and retain overdue as a subset metric', async () => {
    const { service } = makeService({
      total: 4,
      overdue: 1,
      groups: [
        { status: UserStatus.PENDING_APPROVAL, _count: { _all: 3 } },
        { status: UserStatus.COMPLEMENTS_REQUESTED, _count: { _all: 1 } },
      ],
    });
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, {
      statuses: 'PENDING_APPROVAL,COMPLEMENTS_REQUESTED', view: 'queue', overdue: false,
    });
    expect(result.counts.pending + result.counts.complements).toBe(result.total);
    expect(result.counts.overdue).toBe(1);
  });

  it('R-11 returns all decision fields for ACTIVE rows and nulls when inapplicable', async () => {
    const row = companyRow({ user: {
      ...companyRow().user,
      status: UserStatus.ACTIVE,
      approvedAt: date(2),
      approvedBy: 'reviewer-1',
      rejectedAt: null,
      rejectedBy: null,
    } });
    const { service, prisma } = makeService({ rows: [row] });
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { statuses: 'ACTIVE' });
    expect(prisma.company.findMany.mock.calls[0][0].include.user.select).toMatchObject({
      approvedAt: true, approvedBy: true, rejectedAt: true, rejectedBy: true,
    });
    expect(result.items[0]).toMatchObject({
      approvedAt: date(2).toISOString(), approvedBy: 'reviewer-1', rejectedAt: null, rejectedBy: null,
    });
  });

  it('R-12 returns a reviewer for new rejections and null for pre-migration records', async () => {
    const oldRow = companyRow({ id: 'company-old', user: {
      ...companyRow().user, id: 'user-old', rejectedAt: date(1), rejectedBy: null,
    } });
    const newRow = companyRow({ id: 'company-new', user: {
      ...companyRow().user, id: 'user-new', rejectedAt: date(2), rejectedBy: 'reviewer-2',
    } });
    const { service } = makeService({ rows: [oldRow, newRow] });
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { statuses: 'REJECTED' });
    expect(result.items.map((item: any) => item.rejectedBy)).toEqual([null, 'reviewer-2']);
    expect(result.items.every((item: any) => item.rejectedAt)).toBe(true);
  });

  it.each(['ACTIVE,REJECTED', 'PENDING_APPROVAL', 'ACTIVE,PENDING_APPROVAL,REJECTED'])(
    'R-13 keeps territory A scope for statuses=%s and refuses an explicit B region',
    async (statuses) => {
      const { service, prisma } = makeService();
      await service.listCompanyRegistrations(regionalActor, { statuses });
      expect(prisma.company.findMany.mock.calls[0][0].where.region).toEqual({ equals: 'Territory A', mode: 'insensitive' });
      await expect(service.listCompanyRegistrations(regionalActor, { statuses, region: 'Territory B' }))
        .rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each([
    ['queue', 'PENDING_APPROVAL,COMPLEMENTS_REQUESTED', [
      { status: UserStatus.PENDING_APPROVAL, _count: { _all: 3 } },
      { status: UserStatus.COMPLEMENTS_REQUESTED, _count: { _all: 2 } },
    ], 5],
    ['organisations', 'ACTIVE,REJECTED', [
      { status: UserStatus.ACTIVE, _count: { _all: 4 } },
      { status: UserStatus.REJECTED, _count: { _all: 1 } },
    ], 5],
    ['all', 'PENDING_APPROVAL,COMPLEMENTS_REQUESTED,ACTIVE,REJECTED', [
      { status: UserStatus.PENDING_APPROVAL, _count: { _all: 3 } },
      { status: UserStatus.COMPLEMENTS_REQUESTED, _count: { _all: 2 } },
      { status: UserStatus.ACTIVE, _count: { _all: 4 } },
      { status: UserStatus.REJECTED, _count: { _all: 1 } },
    ], 10],
  ])('R-14 %s counts match the base status list total', async (view, statuses, groups, total) => {
    const { service, prisma } = makeService({ total, groups: groups as any });
    const result = await service.listCompanyRegistrations({ role: 'ADMIN_ONEFOP' }, { statuses, view });
    expect(result.total).toBe(total);
    expect(result.counts.pending + result.counts.complements + result.counts.approved + result.counts.rejected).toBe(total);
    expect(result.countsView).toBe(view);
    expect(prisma.user.groupBy.mock.calls[0][0].where.company).toBeDefined();
  });
});
