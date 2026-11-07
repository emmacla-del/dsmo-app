import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { QuestionnairesService } from './questionnaires.service';
import { EligibilityEngineService } from './eligibility-engine.service';
import { AdminQuestionnairesController } from './admin-questionnaires.controller';
import { AuthService } from '../auth/auth.service';

const regionalA = { id: 'actor-a', role: 'REGIONAL_ADMIN', region: 'Centre' };
const national = { id: 'actor-n', role: 'ADMIN_ONEFOP_SUBMISSIONS' };

function activeAgent(overrides: Record<string, any> = {}) {
  return {
    id: 'agent-1',
    email: 'agent@onefop.cm',
    firstName: 'Ada',
    lastName: 'Ngo',
    role: 'REGIONAL_ADMIN',
    isActive: true,
    status: 'ACTIVE',
    archivedAt: null,
    region: 'Centre',
    department: null,
    ...overrides,
  };
}

function submissionTarget(overrides: Record<string, any> = {}) {
  return {
    id: 'sub-1',
    status: 'PENDING_REVIEW',
    updatedAt: new Date('2026-10-29T10:00:00.000Z'),
    revision: 0,
    claimActivityAt: null,
    archivedAt: null,
    assigneeId: null,
    region: 'Centre',
    department: 'Mfoundi',
    regionId: null,
    departmentId: null,
    ...overrides,
  };
}

function transactionalPrisma() {
  const prisma: any = {
    auditLog: { create: jest.fn(async () => ({})), findFirst: jest.fn(async () => null) },
    campaignSubmission: { updateMany: jest.fn(async () => ({ count: 1 })) },
    onefopSubmission: {
      findFirst: jest.fn(async () => submissionTarget()),
      findMany: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
      count: jest.fn(async () => 0),
    },
    company: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    user: { findFirst: jest.fn(async (args: any) => activeAgent({ id: args?.where?.id ?? 'agent-1' })), update: jest.fn(async () => ({})), groupBy: jest.fn(async () => []) },
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

describe('Phase 5 team workflow', () => {
  it('claims an eligible unclaimed dossier for the active caller and records the claim event', async () => {
    const prisma = transactionalPrisma();
    const service = new QuestionnairesService(prisma);

    const result = await service.assignSubmission('sub-1', 'actor-a', 'actor-a', regionalA);

    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'sub-1', status: 'PENDING_REVIEW', assigneeId: null }),
      data: expect.objectContaining({ assigneeId: 'actor-a' }),
    }));
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'DOSSIER_ASSIGNED',
      resourceType: 'OnefopSubmission',
      resourceId: 'sub-1',
      details: {
        assigneeId: 'actor-a',
        assigneeName: 'Ada Ngo',
        previousAssigneeId: null,
        actorRole: 'REGIONAL_ADMIN',
      },
    });
    expect(result).toMatchObject({ id: 'sub-1', assigneeId: 'actor-a', assigneeName: 'Ada Ngo', activityTracked: true });
  });

  it('releases only the caller-owned claim and validates that the caller is active and in scope', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({ assigneeId: 'actor-a' }));
    const service = new QuestionnairesService(prisma);

    const released = await service.assignSubmission('sub-1', null, 'actor-a', regionalA);
    expect(released.assigneeId).toBeNull();
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'sub-1', assigneeId: 'actor-a' }),
      data: expect.objectContaining({ assigneeId: null }),
    }));

    prisma.user.findFirst.mockResolvedValueOnce(activeAgent({ region: 'Littoral' }));
    await expect(service.assignSubmission('sub-1', 'actor-a', 'actor-a', regionalA))
      .rejects.toThrow(ForbiddenException);

    prisma.user.findFirst.mockResolvedValueOnce(activeAgent({ role: 'COMPANY' }));
    await expect(service.assignSubmission('sub-1', 'actor-a', 'actor-a', regionalA))
      .rejects.toThrow(BadRequestException);

    prisma.user.findFirst.mockResolvedValueOnce(activeAgent({ isActive: false }));
    await expect(service.assignSubmission('sub-1', 'actor-a', 'actor-a', regionalA))
      .rejects.toThrow(BadRequestException);
  });

  it('does not overwrite another active claim', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({ assigneeId: 'other-agent' }));
    prisma.auditLog.findFirst.mockResolvedValue({
      action: 'DOSSIER_ASSIGNED', userId: 'other-agent', timestamp: new Date(), details: { assigneeId: 'other-agent' },
    });
    const service = new QuestionnairesService(prisma);

    await expect(service.assignSubmission('sub-1', 'actor-a', 'actor-a', regionalA)).rejects.toThrow(ConflictException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('does not let an authorized national administrator release another user\'s active claim through the self-claim route', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({ assigneeId: 'owner-1' }));
    prisma.user.findFirst.mockResolvedValueOnce(activeAgent({ id: 'actor-n', role: 'ADMIN_ONEFOP_SUBMISSIONS', region: null }));
    prisma.auditLog.findFirst.mockResolvedValue({
      action: 'DOSSIER_ASSIGNED', userId: 'owner-1', timestamp: new Date(), details: { assigneeId: 'owner-1' },
    });
    const service = new QuestionnairesService(prisma);

    await expect(service.assignSubmission('sub-1', null, 'actor-n', national)).rejects.toThrow(ForbiddenException);

    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('reclaims after twelve inactive hours and records that the prior claim had expired', async () => {
    const prisma = transactionalPrisma();
    const lastActivity = new Date(Date.now() - 13 * 60 * 60 * 1000);
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({ assigneeId: 'former-agent', claimActivityAt: lastActivity }));
    const service = new QuestionnairesService(prisma);

    const result = await service.assignSubmission('sub-1', 'actor-a', 'actor-a', regionalA);

    expect(result).toMatchObject({ assigneeId: 'actor-a', activityTracked: true });
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assigneeId: 'former-agent' }),
      data: expect.objectContaining({ assigneeId: 'actor-a' }),
    }));
    expect(prisma.auditLog.create.mock.calls[0][0].data.details).toMatchObject({
      previousAssigneeId: 'former-agent',
      previousClaimExpired: true,
    });
  });

  it('saves a meaningful progress note as auditable claim activity', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({
      assigneeId: 'actor-a', revision: 1, claimActivityAt: new Date(Date.now() - 60 * 60 * 1000),
    }));
    const service = new QuestionnairesService(prisma);

    const result = await service.saveReviewProgress(
      'sub-1', 'Comparaison des effectifs avec les pièces justificatives.', 1, 'actor-a', regionalA,
    );

    expect(result).toMatchObject({ submissionId: 'sub-1', assigneeId: 'actor-a', actorId: 'actor-a' });
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'sub-1', assigneeId: 'actor-a', revision: 1 }),
      data: expect.objectContaining({ claimActivityAt: expect.any(Date), revision: { increment: 1 }, updatedAt: expect.any(Date) }),
    }));
    expect(result).toMatchObject({ revision: 2, lastActivityAt: expect.any(Date) });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'DOSSIER_REVIEW_PROGRESS_SAVED',
      userId: 'actor-a',
      details: { ownerId: 'actor-a', progressType: 'NOTE', note: 'Comparaison des effectifs avec les pièces justificatives.' },
    });
  });

  it('rejects a stale progress revision without writing progress or an audit event', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({
      assigneeId: 'actor-a', revision: 2, claimActivityAt: new Date(),
    }));
    const service = new QuestionnairesService(prisma);

    await expect(service.saveReviewProgress(
      'sub-1', 'Comparaison des effectifs avec les justificatifs.', 1, 'actor-a', regionalA,
    )).rejects.toThrow(ConflictException);

    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a stale review-decision revision without changing the dossier or auditing it', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({
      assigneeId: 'actor-a', revision: 2,
    }));
    const service = new QuestionnairesService(prisma);

    await expect(service.requestCorrection(
      'sub-1', 'Veuillez préciser les justificatifs du dossier.', true, 'actor-a', regionalA, 1,
    )).rejects.toThrow(ConflictException);

    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not let a progress note revive an expired claim and synchronously clears it', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({
      assigneeId: 'actor-a', revision: 1, claimActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    }));
    const service = new QuestionnairesService(prisma);

    await expect(service.saveReviewProgress(
      'sub-1', 'Comparaison approfondie avec les justificatifs.', 1, 'actor-a', regionalA,
    )).rejects.toThrow(ConflictException);
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assigneeId: null }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DOSSIER_CLAIM_EXPIRED',
        resourceId: 'sub-1',
        details: expect.objectContaining({ previousAssigneeId: 'actor-a', reason: 'INACTIVITY' }),
      }),
    });
  });

  it('does not clear or emit an expiration audit when another reviewer tries to save progress on an expired claim', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({
      assigneeId: 'owner-1', revision: 1, claimActivityAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    }));
    const service = new QuestionnairesService(prisma);

    await expect(service.saveReviewProgress(
      'sub-1', 'Comparaison approfondie avec les justificatifs.', 1, 'actor-a', regionalA,
    )).rejects.toThrow(ForbiddenException);

    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('allows only one of two simultaneous claims using the row compare-and-swap', async () => {
    const row: any = submissionTarget({ updatedAt: new Date('2026-10-29T10:00:00.000Z') });
    const events: any[] = [];
    const matches = (where: any) => {
      if (where.id !== undefined && row.id !== where.id) return false;
      if (where.status !== undefined && row.status !== where.status) return false;
      if (where.assigneeId !== undefined && row.assigneeId !== where.assigneeId) return false;
      if (where.revision !== undefined && row.revision !== where.revision) return false;
      if (where.archivedAt === null && row.archivedAt !== null) return false;
      return true;
    };
    const prisma: any = {
      onefopSubmission: {
        findFirst: jest.fn(async () => ({ ...row })),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (!matches(where)) return { count: 0 };
          const { revision: revisionChange, ...otherData } = data;
          Object.assign(row, otherData);
          if (revisionChange?.increment) row.revision += revisionChange.increment;
          return { count: 1 };
        }),
      },
      user: { findFirst: jest.fn(async ({ where }: any) => activeAgent({ id: where.id })) },
      auditLog: {
        findFirst: jest.fn(async ({ where }: any) => events
          .filter((event) => event.resourceType === where.resourceType && event.resourceId === where.resourceId && where.action.in.includes(event.action))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] ?? null),
        create: jest.fn(async ({ data }: any) => {
          const event = { ...data, timestamp: data.timestamp ?? new Date() };
          events.push(event);
          return event;
        }),
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    const service = new QuestionnairesService(prisma);

    const results = await Promise.allSettled([
      service.assignSubmission('sub-1', 'agent-a', 'agent-a', { role: 'REGIONAL_ADMIN', region: 'Centre' }),
      service.assignSubmission('sub-1', 'agent-b', 'agent-b', { role: 'REGIONAL_ADMIN', region: 'Centre' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(['agent-a', 'agent-b']).toContain(row.assigneeId);
    expect(events.filter((event) => event.action === 'DOSSIER_ASSIGNED')).toHaveLength(1);
  });

  it('P5-3 bulk correction only sends PENDING_REVIEW files back, audits each one and keeps the campaign in progress', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findMany.mockResolvedValue([
      { id: 'pending-1', status: 'PENDING_REVIEW', assigneeId: 'actor-n', revision: 1, claimActivityAt: null, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre', department: 'Mf', campaignId: 'camp-1', establishmentId: 'est-1', companyId: null },
      { id: 'correction-1', status: 'CORRECTION_REQUESTED', assigneeId: 'actor-n', revision: 1, claimActivityAt: null, updatedAt: new Date('2026-10-29T10:00:00.000Z'), region: 'Centre', department: 'Mf', campaignId: null, establishmentId: null, companyId: null },
    ]);
    const engine = new EligibilityEngineService(prisma);

    const result = await engine.executeBulkRequestCorrection(
      { id: 'actor-n', role: 'ADMIN_ONEFOP_SUBMISSIONS', email: 'n@onefop.cm' },
      {
        submissionIds: ['pending-1', 'correction-1', 'missing-1'],
        certified: true,
        reason: 'Le tableau 4.1 ne correspond pas aux effectifs déclarés.',
      },
    );

    expect(result.correctedIds).toEqual(['pending-1']);
    expect(result.skippedItems).toEqual([
      { id: 'missing-1', reason: 'Dossier introuvable ou hors ressort.' },
      { id: 'correction-1', reason: 'Statut administratif invalide (CORRECTION_REQUESTED).' },
    ]);
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'pending-1', status: 'PENDING_REVIEW', assigneeId: 'actor-n' }),
      data: expect.objectContaining({ status: 'CORRECTION_REQUESTED', reviewedBy: 'actor-n', assigneeId: null }),
    }));
    const correctionAudits = prisma.auditLog.create.mock.calls
      .map((call: any[]) => call[0].data)
      .filter((row: any) => row.action === 'AUDIT_CORRECTION');
    expect(correctionAudits).toHaveLength(1);
    expect(correctionAudits[0]).toMatchObject({
      resourceId: 'pending-1',
      details: { bulk: true, certified: true, previousStatus: 'PENDING_REVIEW' },
    });
    expect(prisma.campaignSubmission.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'camp-1', establishmentId: 'est-1' },
      data: { status: 'IN_PROGRESS', submittedAt: null },
    });
  });

  it('P5-4 assignedToMe narrows the dossier list to the caller and the list projects the assignee name', async () => {
    const service: any = {
      listForAdmin: jest.fn(async () => ({ items: [], total: 0 })),
    };
    const controller = new AdminQuestionnairesController(service, {} as any);

    await controller.getAll(
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      { user: { id: 'agent-1', role: 'REGIONAL_ADMIN', region: 'Centre' } },
      undefined, undefined, 'true',
    );
    expect(service.listForAdmin.mock.calls[0][0].assigneeId).toBe('agent-1');

    await controller.getAll(
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      { user: { id: 'agent-1', role: 'REGIONAL_ADMIN', region: 'Centre' } },
      undefined, undefined, 'false',
    );
    expect(service.listForAdmin.mock.calls[1][0].assigneeId).toBeUndefined();

    const prisma: any = {
      onefopSubmission: {
        findMany: jest.fn(async () => [{
          id: 'sub-1',
          status: 'PENDING_REVIEW',
          archivedAt: null,
          assigneeId: 'agent-1',
          assignee: { id: 'agent-1', firstName: 'Ada', lastName: 'Ngo', email: 'agent@onefop.cm' },
          campaign: null,
        }]),
        count: jest.fn(async () => 1),
      },
      auditLog: {
        findMany: jest.fn(async () => []),
      },
    };
    const questionnaires = new QuestionnairesService(prisma);
    const page = await questionnaires.listForAdmin({ limit: 10, offset: 0 }, national);
    expect(page.items[0].assigneeId).toBe('agent-1');
    expect(page.items[0].assigneeName).toBe('Ada Ngo');
  });

  it('P5-5b refuses a claim when the file is no longer held by who the screen showed', async () => {
    const prisma = transactionalPrisma() as any;
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-1',
      region: 'Centre',
      department: 'Mfoundi',
      regionId: null,
      departmentId: null,
      user: { id: 'user-1', assigneeId: 'first-agent' },
    });
    prisma.user.updateMany = jest.fn(async () => ({ count: 0 }));
    const auth = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(auth.assignRegistration('user-1', 'agent-1', 'actor-a', regionalA, null)).rejects.toThrow(ConflictException);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', assigneeId: null },
      data: { assigneeId: 'agent-1' },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('P5-5 assigns a registration, filters registration rows by assignee and reports whether the entity has filed', async () => {
    const prisma = transactionalPrisma() as any;
    prisma.company.findFirst.mockResolvedValue({
      id: 'company-1',
      region: 'Centre',
      department: 'Mfoundi',
      regionId: null,
      departmentId: null,
      user: { id: 'user-1', assigneeId: 'previous-agent' },
    });
    prisma.user.updateMany = jest.fn(async () => ({ count: 1 }));
    const auth = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    const assigned = await auth.assignRegistration('user-1', 'agent-1', 'actor-a', regionalA);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { assigneeId: 'agent-1' },
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'REGISTRATION_ASSIGNED',
      resourceType: 'User',
      resourceId: 'user-1',
      details: { assigneeId: 'agent-1', previousAssigneeId: 'previous-agent' },
    });
    expect(assigned).toMatchObject({ id: 'user-1', assigneeId: 'agent-1' });

    const row = {
      id: 'company-1',
      name: 'Alpha SARL',
      taxNumber: 'NIU-1',
      cnpsNumber: null,
      subdivisionId: null,
      entityType: 'COMPANY',
      region: 'Centre',
      department: 'Mfoundi',
      createdAt: new Date('2026-10-01T00:00:00Z'),
      updatedAt: new Date('2026-10-02T00:00:00Z'),
      phone: null,
      respondentFirstName: null,
      respondentLastName: null,
      respondentFunction: null,
      respondentPhone: null,
      respondentPhone2: null,
      _count: { onefopSubmissions: 2 },
      user: {
        id: 'user-1',
        email: 'alpha@example.cm',
        status: 'PENDING_APPROVAL',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        isActive: true,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        archivedByUser: null,
        approvalComment: null,
        rejectionReason: null,
        registrationNumber: null,
        registrationMethod: 'SELF_REGISTRATION',
        createdBy: null,
        assigneeId: 'agent-1',
        assignee: { id: 'agent-1', firstName: 'Ada', lastName: 'Ngo', email: 'agent@onefop.cm' },
        createdByUser: null,
      },
    };
    const listPrisma: any = {
      company: {
        count: jest.fn(async () => 1),
        findMany: jest.fn()
          .mockResolvedValueOnce([row])
          .mockResolvedValueOnce([]),
      },
      auditLog: { findMany: jest.fn(async () => []) },
    };
    const listService = new AuthService(
      listPrisma,
      {} as any,
      {} as any,
      {} as any,
      { getSettings: jest.fn(async () => ({ registrationOverdueDays: 7 })) } as any,
    );
    (listService as any).companyRegistrationCounts = jest.fn(async () => ({
      pending: 1, complements: 0, approved: 0, rejected: 0, overdue: 0,
    }));
    (listService as any).lastResubmissionByUser = jest.fn(async () => new Map());

    const page = await listService.listCompanyRegistrations(regionalA, {
      status: 'ALL',
      assigneeId: 'agent-1',
    });

    expect(listPrisma.company.findMany.mock.calls[0][0].where.user).toMatchObject({ assigneeId: 'agent-1' });
    expect(page.items[0].assigneeId).toBe('agent-1');
    expect(page.items[0].assigneeName).toBe('Ada Ngo');
    expect(page.items[0].hasSubmitted).toBe(true);
  });

  it('P5-6 puts the organisation registration status on the dossier row, without leaking the company record', async () => {
    const prisma: any = {
      onefopSubmission: {
        findMany: jest.fn(async () => [
          {
            id: 'sub-1',
            submissionId: 'SUB-1',
            status: 'PENDING_REVIEW',
            createdAt: new Date(),
            campaign: null,
            assignee: null,
            company: { user: { status: 'ACTIVE' } },
          },
          {
            id: 'sub-2',
            submissionId: 'SUB-2',
            status: 'PENDING_REVIEW',
            createdAt: new Date(),
            campaign: null,
            assignee: null,
            company: null,
          },
        ]),
        count: jest.fn(async () => 2),
      },
    };
    const service = new QuestionnairesService(prisma);

    const page = await service.listForAdmin({ limit: 10, offset: 0 }, national);

    expect(page.items[0].companyRegistrationStatus).toBe('ACTIVE');
    expect(page.items[1].companyRegistrationStatus).toBeNull();
    expect(page.items[0]).not.toHaveProperty('company');
  });
});
