import { ForbiddenException } from '@nestjs/common';
import { QuestionnairesService } from './questionnaires.service';
import { EligibilityEngineService } from './eligibility-engine.service';
import { canReadStaffNames, withoutStaffNames } from './staff-names';

/**
 * 2026-10-15: the admin file page of a VT file. It renders the answers from
 * rawData, so GET /admin/questionnaires/:id no longer loads the statistical
 * child tables; review decisions read only the fields they need; and the
 * 8.8 staff names reach Super Admin and submission reviewers only (§21).
 */
const RAW = {
  VT1_2: 'CFP Test',
  s4q1_licence_male: 3,
  s8q8_row1_lastName: 'Nom',
  s8q8_row1_firstName: 'Prénom',
  s8q8_row1_sex: 'M',
};

const territory = (role: string) => ({ role, region: 'Littoral', department: 'Wouri', regionId: null, departmentId: null }) as any;

describe('staff names (8.8)', () => {
  it('only central administrators and submission administrators may read them', () => {
    expect(canReadStaffNames('SUPER_ADMIN')).toBe(true);
    expect(canReadStaffNames('ADMIN_ONEFOP')).toBe(true);
    expect(canReadStaffNames('ADMIN_ONEFOP_SUBMISSIONS')).toBe(true);
    for (const role of ['ADMIN_ONEFOP_REGISTRATIONS', 'REGIONAL_ADMIN', 'DIVISIONAL_ADMIN', 'CENTRAL_AGENT', 'COMPANY', null, undefined]) {
      expect(canReadStaffNames(role as any)).toBe(false);
    }
  });

  it('drops every s8q8_ key for other roles and keeps the rest', () => {
    const out = withoutStaffNames(RAW, 'REGIONAL_ADMIN') as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(['VT1_2', 's4q1_licence_male']);
    expect(RAW.s8q8_row1_lastName).toBe('Nom'); // the stored object is not mutated
  });

  it('returns rawData unchanged for a central role, and non-objects as they are', () => {
    expect(withoutStaffNames(RAW, 'ADMIN_ONEFOP')).toBe(RAW);
    expect(withoutStaffNames(null, 'REGIONAL_ADMIN')).toBeNull();
    expect(withoutStaffNames('x', 'REGIONAL_ADMIN')).toBe('x');
  });
});

describe('getById for the admin file page', () => {
  const load = async (role: string) => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'db-1', submissionId: 'ref-1', formType: 'VOCATIONAL_TRAINING', rawData: { ...RAW } });
    const detail = { findUnique: jest.fn().mockResolvedValue({ name: 'CFP Test' }) };
    const respondent = { findUnique: jest.fn().mockResolvedValue({ respondentName: 'R. Test' }) };
    const prisma = { onefopSubmission: { findFirst }, onefopVocationalTrainingDetail: detail, onefopRespondent: respondent, $queryRaw: jest.fn().mockResolvedValue([]) };
    const service = new QuestionnairesService(prisma as any);
    const found: any = await service.getById('ref-1', territory(role));
    return { found, args: findFirst.mock.calls[0][0], detail };
  };

  it('loads the respondent and the detail of the file\'s form, not the statistical tables', async () => {
    const { found, args, detail } = await load('SUPER_ADMIN');
    expect(args.include).toBeUndefined();
    expect(detail.findUnique).toHaveBeenCalledWith({ where: { submissionId: 'db-1' } });
    expect(found.vocationalTrainingDetail).toEqual({ name: 'CFP Test' });
    expect(found.respondent).toEqual({ respondentName: 'R. Test' });
    for (const key of ['enterpriseDetail', 'cooperativeDetail', 'ctdDetail', 'ongDetail', 'administrationDetail', 'projectProgramDetail']) {
      expect(found[key]).toBeNull();
    }
    for (const table of ['vtDiplomaData', 'vtSpecialtyRows', 'vtTrainerRoster', 'cspGenderAge', 'trainingNeeds', 'projectProgramActivities']) {
      expect(found).not.toHaveProperty(table);
    }
  });

  it('keeps 8.8 for central and submission administrators', async () => {
    expect((await load('SUPER_ADMIN')).found.rawData.s8q8_row1_lastName).toBe('Nom');
    expect((await load('ADMIN_ONEFOP')).found.rawData.s8q8_row1_lastName).toBe('Nom');
    expect((await load('ADMIN_ONEFOP_SUBMISSIONS')).found.rawData.s8q8_row1_lastName).toBe('Nom');
  });

  it('strips 8.8 for regional, divisional and read-only central roles', async () => {
    for (const role of ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN', 'CENTRAL_AGENT']) {
      const { found } = await load(role);
      expect(Object.keys(found.rawData).some((k) => k.startsWith('s8q8_'))).toBe(false);
      expect(found.rawData.s4q1_licence_male).toBe(3);
    }
  });
});

describe('review decisions read only what they need', () => {
  const REVISION = new Date('2026-10-27T09:30:00.000Z');

  const setup = ({ assigneeId = 'admin-1' }: { assigneeId?: string | null } = {}) => {
    const prisma: any = {
      onefopSubmission: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'db-1', status: 'APPROVED' }),
      },
      onefopAnomaly: { createMany: jest.fn(), findMany: jest.fn() },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(
          assigneeId
            ? {
                action: 'DOSSIER_ASSIGNED',
                userId: assigneeId,
                timestamp: new Date(),
                details: { assigneeId },
              }
            : null,
        ),
      },
      campaignSubmission: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
    const service = new QuestionnairesService(prisma, undefined, new EligibilityEngineService(prisma));
    return { prisma, service };
  };

  it('approve, opened from the receipt reference, selects a few fields and writes under the dossier id', async () => {
    const { prisma, service } = setup();
    prisma.onefopSubmission.findFirst
      .mockResolvedValueOnce({ id: 'db-1', status: 'PENDING_REVIEW', campaignId: null, establishmentId: 'e-1', updatedAt: REVISION, revision: 1, assigneeId: 'admin-1', archivedAt: null })
      .mockResolvedValueOnce({ id: 'db-1', status: 'PENDING_REVIEW', anomalies: [], updatedAt: REVISION, revision: 1, assigneeId: 'admin-1', archivedAt: null });

    await service.approve('ref-1', 'admin-1', territory('ADMIN_ONEFOP'), 1);

    const lookup = prisma.onefopSubmission.findFirst.mock.calls[0][0];
    expect(lookup.select).toEqual(expect.objectContaining({ id: true, status: true }));
    expect(lookup.include).toBeUndefined();
    expect(prisma.onefopSubmission.findFirst.mock.calls[1][0].where.AND[0]).toEqual({ OR: [{ id: 'db-1' }, { submissionId: 'db-1' }] });
    expect(prisma.auditLog.create.mock.calls[0][0].data.resourceId).toBe('db-1');
    expect(prisma.onefopSubmission.updateMany.mock.calls[0][0].where).toEqual({
      id: 'db-1',
      status: 'PENDING_REVIEW',
      revision: 1,
      assigneeId: 'admin-1',
      archivedAt: null,
      // The approve guard re-checks anomalies inside the conditional update, so
      // an anomaly raised after assertCanApprove cannot slip past the decision.
      anomalies: { none: { status: 'OPEN' } },
    });
    expect(prisma.onefopSubmission.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ assigneeId: null }),
    );
  });

  it('reject and request-correction use the same lean lookup', async () => {
    for (const act of ['reject', 'correction'] as const) {
      const { prisma, service } = setup();
      prisma.onefopSubmission.findFirst.mockResolvedValue({
        id: 'db-1',
        status: 'PENDING_REVIEW',
        revision: 1,
        assigneeId: 'admin-1',
        archivedAt: null,
      });
      if (act === 'reject') {
        await service.reject('ref-1', 'Motif suffisamment long', 'admin-1', territory('ADMIN_ONEFOP'), 1);
      } else {
        await service.requestCorrection(
          'ref-1', 'Commentaire assez long', true, 'admin-1', territory('ADMIN_ONEFOP'), 1,
        );
      }
      expect(prisma.onefopSubmission.findFirst.mock.calls[0][0].select).toBeDefined();
      expect(prisma.onefopSubmission.updateMany.mock.calls[0][0].where).toEqual({
        id: 'db-1',
        status: 'PENDING_REVIEW',
        revision: 1,
        assigneeId: 'admin-1',
        archivedAt: null,
      });
    }
  });

  it.each(['reject', 'correction'] as const)('refuses %s when no reviewer owns the file', async (act) => {
    const { prisma, service } = setup({ assigneeId: null });
    prisma.onefopSubmission.findFirst.mockResolvedValue({
      id: 'db-1',
      status: 'PENDING_REVIEW',
      updatedAt: REVISION,
      revision: 1,
      assigneeId: null,
      archivedAt: null,
    });
    const call = act === 'reject'
      ? service.reject('ref-1', 'Motif suffisamment long', 'admin-1', territory('ADMIN_ONEFOP'), 1)
      : service.requestCorrection(
          'ref-1', 'Commentaire assez long', true, 'admin-1', territory('ADMIN_ONEFOP'), 1,
        );
    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });

  it.each(['reject', 'correction'] as const)('refuses %s when another reviewer owns the file', async (act) => {
    const { prisma, service } = setup({ assigneeId: 'other-admin' });
    prisma.onefopSubmission.findFirst.mockResolvedValue({
      id: 'db-1',
      status: 'PENDING_REVIEW',
      updatedAt: REVISION,
      revision: 1,
      assigneeId: 'other-admin',
      archivedAt: null,
    });
    const call = act === 'reject'
      ? service.reject('ref-1', 'Motif suffisamment long', 'admin-1', territory('ADMIN_ONEFOP'), 1)
      : service.requestCorrection(
          'ref-1', 'Commentaire assez long', true, 'admin-1', territory('ADMIN_ONEFOP'), 1,
        );
    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });
});
