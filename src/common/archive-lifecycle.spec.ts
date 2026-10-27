import { AuthService } from '../auth/auth.service';
import { QuestionnairesService } from '../questionnaires/questionnaires.service';
import { EligibilityEngineService } from '../questionnaires/eligibility-engine.service';
import { buildAdminListWhere } from '../questionnaires/admin-list-filter';

describe('Phase 4 archive lifecycle', () => {
  const regional = { role: 'REGIONAL_ADMIN', region: 'Centre' };

  function authService(user: any) {
    const tx = {
      user: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.archivedAt === null) return user.archivedAt ? null : user;
          if (where.archivedAt?.not === null) return user.archivedAt ? user : null;
          return user;
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: jest.fn(async (args: any) => args) },
    };
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    const service = new AuthService(prisma as any, {} as any, {} as any, {} as any, {} as any);
    return { service, tx, prisma };
  }

  function dossierService(submission: any) {
    const tx = {
      onefopSubmission: {
        findFirst: jest.fn(async ({ where }: any) => {
          const state = where.AND[1];
          return state.archivedAt === null
            ? submission.archivedAt ? null : submission
            : submission.archivedAt ? submission : null;
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: jest.fn(async (args: any) => args) },
    };
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    return { service: new QuestionnairesService(prisma as any), tx, prisma };
  }

  it('P4-1 archives a registration and audits actor, target, and trimmed reason', async () => {
    const { service, tx } = authService({ id: 'u1', role: 'COMPANY', region: 'Centre', archivedAt: null });
    await service.archiveUser('u1', '  duplicate record  ', 'admin1', 'REGIONAL_ADMIN', regional as any);
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archiveReason: 'duplicate record' }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'admin1', action: 'REGISTRATION_ARCHIVED', resourceId: 'u1', details: { reason: 'duplicate record', actorRole: 'REGIONAL_ADMIN' } }) }));
  });

  it('P4-2 restores a registration, clearing archive metadata and auditing the restore', async () => {
    const { service, tx } = authService({ id: 'u1', role: 'COMPANY', region: 'Centre', archivedAt: new Date(), archiveReason: 'old' });
    await service.restoreUser('u1', 'reviewed', 'admin1', 'REGIONAL_ADMIN', regional as any);
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { archivedAt: null, archivedBy: null, archiveReason: null } }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REGISTRATION_RESTORED', resourceId: 'u1' }) }));
  });

  it('P4-3 requires a nonblank archive reason', async () => {
    const { service, prisma } = authService({ id: 'u1', role: 'COMPANY', region: 'Centre', archivedAt: null });
    await expect(service.archiveUser('u1', '  ', 'admin1', 'REGIONAL_ADMIN', regional as any)).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('P4-4 refuses archive on a record already archived', async () => {
    const { service } = authService({ id: 'u1', role: 'COMPANY', region: 'Centre', archivedAt: new Date() });
    await expect(service.archiveUser('u1', 'reason', 'admin1', 'REGIONAL_ADMIN', regional as any)).rejects.toThrow();
  });

  it('refuses to restore a registration that is not archived', async () => {
    const { service } = authService({ id: 'u1', role: 'COMPANY', region: 'Centre', archivedAt: null });
    await expect(service.restoreUser('u1', undefined, 'admin1', 'REGIONAL_ADMIN', regional as any)).rejects.toThrow();
  });

  it('P4-5 and P4-6 refuse cross-territory registration archive and restore', async () => {
    const { service } = authService({ id: 'u1', role: 'COMPANY', region: 'Littoral', archivedAt: new Date() });
    await expect(service.archiveUser('u1', 'reason', 'admin1', 'REGIONAL_ADMIN', regional as any)).rejects.toThrow();
    await expect(service.restoreUser('u1', undefined, 'admin1', 'REGIONAL_ADMIN', regional as any)).rejects.toThrow();
  });

  it('P4-7 archives a declaration and writes the dossier audit entry', async () => {
    const { service, tx } = dossierService({ id: 'd1', region: 'Centre', department: 'Mfoundi', archivedAt: null });
    await service.archiveSubmission('d1', 'duplicate', 'admin1', regional as any);
    expect(tx.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archiveReason: 'duplicate' }) }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'admin1', action: 'DOSSIER_ARCHIVED', resourceId: 'd1' }) }));
  });

  it('P4-8 refuses a declaration restore outside the actor territory', async () => {
    const { service } = dossierService({ id: 'd1', region: 'Littoral', department: 'Wouri', archivedAt: new Date() });
    await expect(service.restoreSubmission('d1', undefined, 'admin1', regional as any)).rejects.toThrow();
  });

  it('refuses a declaration archive outside the actor territory', async () => {
    const { service } = dossierService({ id: 'd1', region: 'Littoral', department: 'Wouri', archivedAt: null });
    await expect(service.archiveSubmission('d1', 'reason', 'admin1', regional as any)).rejects.toThrow();
  });

  it('restores a declaration and writes its audit row', async () => {
    const { service, tx } = dossierService({ id: 'd1', region: 'Centre', department: 'Mfoundi', archivedAt: new Date(), archiveReason: 'old' });
    await service.restoreSubmission('d1', undefined, 'admin1', regional as any);
    expect(tx.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { archivedAt: null, archivedBy: null, archiveReason: null } }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DOSSIER_RESTORED', resourceId: 'd1' }) }));
  });

  it('P4-9 through P4-14: ordinary dossier list predicates exclude archived; explicit completed inclusion allows both states', () => {
    const ordinary = buildAdminListWhere({});
    expect(ordinary.AND).toContainEqual({ archivedAt: null });
    const completedWithArchived = buildAdminListWhere({ statuses: ['APPROVED', 'REJECTED', 'SUPERSEDED'] }, undefined, new Date(), true);
    expect(completedWithArchived.AND).toContainEqual({ OR: [{ archivedAt: null }, { archivedAt: { not: null } }] });
    const completedWithoutArchived = buildAdminListWhere({ statuses: ['APPROVED', 'REJECTED', 'SUPERSEDED'] });
    expect(completedWithoutArchived.AND).toContainEqual({ archivedAt: null });
  });

  it('P4-9 default detail excludes archived and completed detail can explicitly include archived', async () => {
    const findFirst = jest.fn(async () => ({ id: 'd1', rawData: {}, establishment: null }));
    const service = new QuestionnairesService({ onefopSubmission: { findFirst } } as any);
    await service.getById('d1');
    expect((findFirst.mock.calls as any)[0][0].where.AND).toContainEqual({ archivedAt: null });
    await service.getById('d1', undefined, true);
    expect((findFirst.mock.calls as any)[1][0].where.AND).toContainEqual({ OR: [{ archivedAt: null }, { archivedAt: { not: null } }] });
  });

  it('P4-21 registration CSV defaults to the active review queue and can include archived records', async () => {
    const findMany = jest.fn(async (_args: any) => []);
    const service = new AuthService({ company: { findMany } } as any, {} as any, {} as any, {} as any, {} as any);
    await service.exportCompanyRegistrations(regional as any);
    expect((findMany.mock.calls as any)[0][0].where.user.is).toEqual({
      role: 'COMPANY',
      status: { in: ['PENDING_APPROVAL', 'COMPLEMENTS_REQUESTED'] },
      archivedAt: null,
    });
    await service.exportCompanyRegistrations(regional as any, true);
    expect((findMany.mock.calls as any)[1][0].where.user.is).toEqual({
      role: 'COMPANY',
      status: { in: ['PENDING_APPROVAL', 'COMPLEMENTS_REQUESTED'] },
      OR: [{ archivedAt: null }, { archivedAt: { not: null } }],
    });
    expect((findMany.mock.calls as any)[0][0].select.user.select).toHaveProperty('rejectedBy', true);
  });

  it('P4-18 through P4-20 and P4-26: submission queues/counts exclude archived while completed follows its toggle', async () => {
    const groupBy = jest.fn(async (_args: any) => []);
    const prisma: any = {
      onefopSubmission: {
        groupBy,
        count: jest.fn(async () => 0),
        aggregate: jest.fn(async () => ({ _min: { submissionDate: null } })),
        findMany: jest.fn(async () => []),
      },
      onefopAnomaly: { count: jest.fn(async () => 0) },
      auditLog: { findMany: jest.fn(async () => []) },
    };
    const engine = new EligibilityEngineService(prisma);
    await engine.getPilotageQueues(undefined, 'queue');
    expect((groupBy.mock.calls as any)[0][0].where.AND).toContainEqual({ archivedAt: null });
    await engine.getPilotageQueues(undefined, 'completed', false);
    expect((groupBy.mock.calls as any)[2][0].where.AND).toContainEqual({ archivedAt: null });
    await engine.getPilotageQueues(undefined, 'completed', true);
    expect((groupBy.mock.calls as any)[4][0].where.AND).toContainEqual({ OR: [{ archivedAt: null }, { archivedAt: { not: null } }] });
  });

  it('P4-26 registration status counts exclude archived by default and include them only when requested', async () => {
    const groupBy = jest.fn(async (_args: any) => []);
    const service = new AuthService({ user: { groupBy } } as any, {} as any, {} as any, {} as any, {} as any);
    await (service as any).companyRegistrationCounts({}, new Date(), 'organisations', false);
    expect((groupBy.mock.calls as any)[0][0].where.archivedAt).toBeNull();
    await (service as any).companyRegistrationCounts({}, new Date(), 'organisations', true);
    expect((groupBy.mock.calls as any)[1][0].where.OR).toHaveLength(2);
  });
});
