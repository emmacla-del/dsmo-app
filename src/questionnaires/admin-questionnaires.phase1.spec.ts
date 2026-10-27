import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard';
import { AdminQuestionnairesController } from './admin-questionnaires.controller';
import { QuestionnairesService } from './questionnaires.service';
import { EligibilityEngineService } from './eligibility-engine.service';
import { buildAdminListWhere } from './admin-list-filter';

const regionalA = { id: 'a1', role: 'REGIONAL_ADMIN', region: 'Territory A' };
const divisionalB = { id: 'b1', role: 'DIVISIONAL_ADMIN', region: 'Territory A', department: 'Territory B' };
const national = { id: 'n1', role: 'ADMIN_ONEFOP_SUBMISSIONS' };
const allStatuses = 'APPROVED,REJECTED,SUPERSEDED';

function controllerFor(service: any, engine: any = {}) {
  return new AdminQuestionnairesController(service, engine);
}

function callList(controller: AdminQuestionnairesController, user: any, args: Record<string, any> = {}) {
  return controller.getAll(
    args.status, args.statuses, args.limit, args.offset, args.region, args.search,
    args.formType, args.period, args.companyId, args.sort, args.department,
    args.campaignId, args.quarterCode, args.late, args.overdue, { user },
  );
}

function queueEngine(statusGroups: Array<{ status: string; _count: { _all: number } }>) {
  const prisma: any = {
    onefopSubmission: {
      groupBy: jest.fn(async ({ by }: any) => by[0] === 'status'
        ? statusGroups
        : [{ region: 'Territory A', _count: { _all: statusGroups.reduce((n, row) => n + row._count._all, 0) } }]),
      count: jest.fn(async () => 0),
      aggregate: jest.fn(async () => ({ _min: { submissionDate: null } })),
      findMany: jest.fn(async () => []),
    },
    onefopAnomaly: { count: jest.fn(async () => 0) },
    auditLog: { findMany: jest.fn(async () => []) },
  };
  return { engine: new EligibilityEngineService(prisma), prisma };
}

describe('Phase 1b dossier contract', () => {
  it('D-1 scopes the explicit three-status set to territory A and shares the page/count where', async () => {
    const prisma: any = {
      onefopSubmission: {
        findMany: jest.fn(async () => [{ id: 'a-approved', campaign: null }]),
        count: jest.fn(async () => 3),
      },
    };
    const service = new QuestionnairesService(prisma);
    const controller = controllerFor(service);
    const first = await callList(controller, regionalA, { statuses: allStatuses, limit: '2', offset: '0' });
    const second = await callList(controller, regionalA, { statuses: allStatuses, limit: '2', offset: '2' });
    const firstWhere = prisma.onefopSubmission.findMany.mock.calls[0][0].where;
    expect(firstWhere.AND).toContainEqual({ region: { equals: 'Territory A', mode: 'insensitive' } });
    expect(firstWhere.AND).toContainEqual({ status: { in: ['APPROVED', 'REJECTED', 'SUPERSEDED'] } });
    expect(prisma.onefopSubmission.count.mock.calls[0][0].where).toEqual(firstWhere);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    expect(prisma.onefopSubmission.findMany.mock.calls.map((call: any[]) => call[0].skip)).toEqual([0, 2]);
  });

  it('D-2 leaves ADMIN_ONEFOP_SUBMISSIONS national for the status set', async () => {
    const service: any = { listForAdmin: jest.fn(async () => ({ items: [], total: 0 })) };
    await callList(controllerFor(service), national, { statuses: allStatuses });
    expect(service.listForAdmin.mock.calls[0][0].statuses).toEqual(['APPROVED', 'REJECTED', 'SUPERSEDED']);
    expect(service.listForAdmin.mock.calls[0][1]).toMatchObject({ role: 'ADMIN_ONEFOP_SUBMISSIONS' });
  });

  it('D-3 excludes SUPERSEDED when the status set does not request it', () => {
    const where = buildAdminListWhere({ statuses: ['APPROVED', 'REJECTED'] });
    expect(where.AND).toContainEqual({ status: { notIn: ['DRAFT', 'SUPERSEDED'] } });
    expect(where.AND).toContainEqual({ status: { in: ['APPROVED', 'REJECTED'] } });
  });

  it('D-4 includes explicitly requested SUPERSEDED while excluding drafts', () => {
    const where = buildAdminListWhere({ statuses: ['SUPERSEDED'] });
    expect(where.AND).toContainEqual({ status: { notIn: ['DRAFT'] } });
    expect(where.AND).toContainEqual({ status: { in: ['SUPERSEDED'] } });
  });

  it('D-5 excludes SUPERSEDED from the default list', () => {
    expect(buildAdminListWhere({}).AND).toContainEqual({ status: { notIn: ['DRAFT', 'SUPERSEDED'] } });
  });

  it('D-6 rejects OVERDUE in statuses and points to overdue=true', async () => {
    const service = { listForAdmin: jest.fn() };
    await expect(callList(controllerFor(service), national, { statuses: 'OVERDUE' }))
      .rejects.toThrow(/OVERDUE.*overdue=true/);
  });

  it('D-7 rejects simultaneous status and statuses', async () => {
    const service = { listForAdmin: jest.fn() };
    await expect(callList(controllerFor(service), national, { status: 'REJECTED', statuses: 'APPROVED' }))
      .rejects.toThrow(BadRequestException);
  });

  it('D-8 rejects unknown values and names the invalid status', async () => {
    const service = { listForAdmin: jest.fn() };
    await expect(callList(controllerFor(service), national, { statuses: 'APPROVED,BOGUS' }))
      .rejects.toThrow(/BOGUS/);
    await expect(callList(controllerFor(service), national, { statuses: ' , ' }))
      .rejects.toThrow(/au moins un statut/);
  });

  it('D-9 completed counts match the APPROVED, REJECTED, and SUPERSEDED list total', async () => {
    const groups = [
      { status: 'APPROVED', _count: { _all: 2 } },
      { status: 'REJECTED', _count: { _all: 1 } },
      { status: 'SUPERSEDED', _count: { _all: 2 } },
    ];
    const { engine, prisma } = queueEngine(groups);
    const counts = await engine.getPilotageQueues({ role: 'REGIONAL_ADMIN', region: 'Territory A' }, 'completed');
    expect(counts.countsView).toBe('completed');
    expect(counts.totalSubmissionsCount).toBe(5);
    expect(counts.statusCounts.SUPERSEDED).toBe(2);
    expect(prisma.onefopSubmission.groupBy.mock.calls[0][0].where.AND).toContainEqual({
      status: { in: ['APPROVED', 'REJECTED', 'SUPERSEDED'] },
    });
    const listPrisma: any = {
      onefopSubmission: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 5),
      },
    };
    const list = await new QuestionnairesService(listPrisma).listForAdmin({
      statuses: ['APPROVED', 'REJECTED', 'SUPERSEDED'], limit: 100, offset: 0,
    }, { role: 'REGIONAL_ADMIN', region: 'Territory A' });
    expect(counts.totalSubmissionsCount).toBe(list.total);
    const routeEngine = { getPilotageQueues: jest.fn(async () => counts) };
    await controllerFor({}, routeEngine).getQueues('completed', { user: regionalA });
    expect(routeEngine.getPilotageQueues).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'REGIONAL_ADMIN', region: 'Territory A' }), 'completed',
    );
  });

  it('D-10 queue counts match the default list total and both exclude SUPERSEDED', async () => {
    const groups = [
      { status: 'PENDING_REVIEW', _count: { _all: 2 } },
      { status: 'APPROVED', _count: { _all: 1 } },
      { status: 'CORRECTION_REQUESTED', _count: { _all: 1 } },
      { status: 'REJECTED', _count: { _all: 1 } },
    ];
    const { engine, prisma } = queueEngine(groups);
    const counts = await engine.getPilotageQueues({ role: 'REGIONAL_ADMIN', region: 'Territory A' }, 'queue');
    const listWhere = buildAdminListWhere({}, { role: 'REGIONAL_ADMIN', region: 'Territory A' });
    expect(counts.countsView).toBe('queue');
    expect(counts.totalSubmissionsCount).toBe(5);
    expect(prisma.onefopSubmission.groupBy.mock.calls[0][0].where.AND).toEqual(listWhere.AND);
    expect(listWhere.AND).toContainEqual({ status: { notIn: ['DRAFT', 'SUPERSEDED'] } });
    const listPrisma: any = {
      onefopSubmission: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 5),
      },
    };
    const list = await new QuestionnairesService(listPrisma).listForAdmin({ limit: 100, offset: 0 }, {
      role: 'REGIONAL_ADMIN', region: 'Territory A',
    });
    expect(counts.totalSubmissionsCount).toBe(list.total);
  });

  it('D-11 allows CENTRAL_AGENT to read the registrations list route', async () => {
    const roles = Reflect.getMetadata('roles', AdminQuestionnairesController.prototype.getAll) as string[];
    expect(roles).toContain('CENTRAL_AGENT');
    const guard = new RolesGuard(new Reflector(), { getSettings: async () => ({ maintenanceMode: false }) } as any);
    const context: any = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CENTRAL_AGENT' } }) }),
      getHandler: () => AdminQuestionnairesController.prototype.getAll,
      getClass: () => AdminQuestionnairesController,
    };
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('D-12 denies CENTRAL_AGENT export through the existing class role guard', async () => {
    const guard = new RolesGuard(new Reflector(), { getSettings: async () => ({ maintenanceMode: false }) } as any);
    const context: any = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CENTRAL_AGENT' }, query: { statuses: allStatuses } }) }),
      getHandler: () => AdminQuestionnairesController.prototype.exportDossiers,
      getClass: () => AdminQuestionnairesController,
    };
    const authorize = async () => {
      if (!(await guard.canActivate(context))) throw new ForbiddenException();
    };
    await expect(authorize()).rejects.toMatchObject({ status: 403 });
  });

  it('passes the same status set to export as to the dossier list', async () => {
    const service: any = { streamDossiersExport: jest.fn(async () => undefined) };
    const controller = controllerFor(service);
    const response = {} as any;
    await controller.exportDossiers(
      'csv', undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, allStatuses,
      { user: national }, response,
    );
    expect(service.streamDossiersExport.mock.calls[0][0].statuses).toEqual(['APPROVED', 'REJECTED', 'SUPERSEDED']);
  });

  it('D-13 projects campaignName and returns null for missing campaign and decision fields', async () => {
    const prisma: any = {
      onefopSubmission: {
        findMany: jest.fn(async () => [
          { id: 'with-campaign', campaign: { name: 'Cycle A' }, reviewedBy: 'reviewer-1', reviewedAt: new Date('2026-01-02T00:00:00Z'), rejectionReason: null },
          { id: 'without-campaign', campaign: null },
        ]),
        count: jest.fn(async () => 2),
      },
    };
    const result = await new QuestionnairesService(prisma).listForAdmin({ limit: 10, offset: 0 });
    expect(prisma.onefopSubmission.findMany.mock.calls[0][0].include.campaign).toEqual({ select: { name: true } });
    expect(result.items[0]).toMatchObject({ campaignName: 'Cycle A', reviewedBy: 'reviewer-1', reviewedAt: '2026-01-02T00:00:00.000Z', rejectionReason: null });
    expect(result.items[1]).toMatchObject({ campaignName: null, reviewedBy: null, reviewedAt: null, rejectionReason: null });
    expect(Object.keys(result.items[1])).toEqual(expect.arrayContaining(['campaignName', 'reviewedBy', 'reviewedAt', 'rejectionReason']));
  });

  it('D-14 keeps DIVISIONAL_ADMIN territory B on the statuses path', async () => {
    const service: any = { listForAdmin: jest.fn(async () => ({ items: [], total: 0 })) };
    await callList(controllerFor(service), divisionalB, { statuses: allStatuses });
    const where = buildAdminListWhere(service.listForAdmin.mock.calls[0][0], service.listForAdmin.mock.calls[0][1]);
    expect(where.AND[0]).toEqual({
      region: { equals: 'Territory A', mode: 'insensitive' },
      department: { equals: 'Territory B', mode: 'insensitive' },
    });
    expect(where.AND).toContainEqual({ status: { in: ['APPROVED', 'REJECTED', 'SUPERSEDED'] } });
  });
});
