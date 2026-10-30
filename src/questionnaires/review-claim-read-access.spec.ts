import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionnairesService } from './questionnaires.service';

/**
 * Phase 1 review findings 1 and 2.
 *
 * getReviewClaimState and listReviewProgress are dossier GET endpoints. Their
 * row scope comes from territoryWhere, the same read filter every other
 * dossier read uses; assertReadTerritorialAuthority adds the role check on the
 * loaded row. CENTRAL_AGENT is a national READ role, so it may read; it is not
 * in NATIONAL_ROLES, so every write path still refuses it.
 */
const REVISION = new Date('2026-10-27T09:30:00.000Z');

const submission = {
  id: 'db-1',
  status: 'PENDING_REVIEW',
  assigneeId: null as string | null,
  archivedAt: null,
  region: 'Littoral',
  department: 'Wouri',
  regionId: null,
  departmentId: null,
  updatedAt: REVISION,
};

const territory = (role: string, region = 'Littoral', department = 'Wouri') => ({
  role,
  region,
  department,
  regionId: null,
  departmentId: null,
}) as any;

function rowMatches(where: any): boolean {
  const filter = where?.AND?.[1] ?? {};
  if (filter.region?.equals && filter.region.equals.toLowerCase() !== submission.region.toLowerCase()) return false;
  if (filter.department?.equals && filter.department.equals.toLowerCase() !== submission.department.toLowerCase()) return false;
  if (filter.regionId && filter.regionId !== submission.regionId) return false;
  if (filter.departmentId && filter.departmentId !== submission.departmentId) return false;
  return true;
}

function setup({ assigneeId = null }: { assigneeId?: string | null } = {}) {
  const row = { ...submission, assigneeId };
  const prisma: any = {
    onefopSubmission: {
      findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(rowMatches(where) ? { ...row } : null)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  const service = new QuestionnairesService(
    prisma,
    undefined,
    { assertCanApprove: jest.fn().mockResolvedValue({}) } as any,
  );
  return { service, prisma };
}

describe('review claim-state reads', () => {
  it.each([
    ['REGIONAL_ADMIN', 'Littoral', 'Wouri'],
    ['DIVISIONAL_ADMIN', 'Littoral', 'Wouri'],
  ])('lets %s read a file inside their territory', async (role, region, department) => {
    const { service } = setup();
    const state = await service.getReviewClaimState('db-1', territory(role, region, department));
    expect(state).toEqual(expect.objectContaining({ submissionId: 'db-1', eligible: true }));
  });

  it.each([
    ['REGIONAL_ADMIN', 'Centre', 'Wouri'],
    ['DIVISIONAL_ADMIN', 'Littoral', 'Moungo'],
  ])('refuses %s a file outside their territory', async (role, region, department) => {
    const { service } = setup();
    await expect(
      service.getReviewClaimState('db-1', territory(role, region, department)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets CENTRAL_AGENT read nationally, under the same read scope as the dossier list', async () => {
    const { service, prisma } = setup();
    const state = await service.getReviewClaimState('db-1', territory('CENTRAL_AGENT'));
    expect(state).toEqual(expect.objectContaining({ submissionId: 'db-1', eligible: true }));
    expect(prisma.onefopSubmission.findFirst.mock.calls[0][0].where.AND[1]).toEqual({});
  });
});

describe('review progress reads', () => {
  it.each([
    ['REGIONAL_ADMIN', 'Littoral', 'Wouri'],
    ['DIVISIONAL_ADMIN', 'Littoral', 'Wouri'],
  ])('lets %s read progress inside their territory', async (role, region, department) => {
    const { service, prisma } = setup();
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'evt-1', userId: 'admin-1', timestamp: REVISION, details: { progressType: 'NOTE', note: 'Contrôle des effectifs' } },
    ]);
    const result = await service.listReviewProgress('db-1', territory(role, region, department));
    expect(result.items).toEqual([
      {
        id: 'evt-1',
        actorId: 'admin-1',
        createdAt: REVISION,
        progressType: 'NOTE',
        note: 'Contrôle des effectifs',
        anomalyId: null,
      },
    ]);
  });

  it.each([
    ['REGIONAL_ADMIN', 'Centre', 'Wouri'],
    ['DIVISIONAL_ADMIN', 'Littoral', 'Moungo'],
  ])('refuses %s progress outside their territory', async (role, region, department) => {
    const { service } = setup();
    await expect(
      service.listReviewProgress('db-1', territory(role, region, department)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets CENTRAL_AGENT read progress nationally', async () => {
    const { service, prisma } = setup();
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'evt-1', userId: 'admin-1', timestamp: REVISION, details: { progressType: 'NOTE', note: 'Contrôle des effectifs' } },
    ]);
    const result = await service.listReviewProgress('db-1', territory('CENTRAL_AGENT'));
    expect(result.items).toHaveLength(1);
  });
});

describe('CENTRAL_AGENT remains read-only', () => {
  it('cannot claim a file', async () => {
    const { service, prisma } = setup();
    await expect(
      service.assignSubmission('db-1', 'central-1', 'central-1', territory('CENTRAL_AGENT')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('cannot release a claim', async () => {
    const { service, prisma } = setup({ assigneeId: 'central-1' });
    await expect(
      service.assignSubmission('db-1', null, 'central-1', territory('CENTRAL_AGENT')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('cannot save progress', async () => {
    const { service, prisma } = setup({ assigneeId: 'central-1' });
    await expect(
      service.saveReviewProgress('db-1', 'Contrôle des effectifs', REVISION.toISOString(), 'central-1', territory('CENTRAL_AGENT')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });

  it.each(['approve', 'reject', 'correction'] as const)('cannot %s, even if named as assignee', async (action) => {
    const { service, prisma } = setup({ assigneeId: 'central-1' });
    const call = action === 'approve'
      ? service.approve('db-1', 'central-1', territory('CENTRAL_AGENT'), REVISION.toISOString())
      : action === 'reject'
        ? service.reject('db-1', 'Motif suffisamment long', 'central-1', territory('CENTRAL_AGENT'), REVISION.toISOString())
        : service.requestCorrection('db-1', 'Commentaire assez long', true, 'central-1', territory('CENTRAL_AGENT'), REVISION.toISOString());
    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });
});

describe('territorial restrictions still apply to field reviewers', () => {
  it('refuses regional and divisional writes outside their territory', async () => {
    const regional = setup();
    await expect(
      regional.service.assignSubmission('db-1', 'reg-1', 'reg-1', territory('REGIONAL_ADMIN', 'Centre', 'Wouri')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(regional.prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();

    const divisional = setup();
    await expect(
      divisional.service.assignSubmission('db-1', 'div-1', 'div-1', territory('DIVISIONAL_ADMIN', 'Littoral', 'Moungo')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(divisional.prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });
});
