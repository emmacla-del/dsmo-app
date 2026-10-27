import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    auditLog: { create: jest.fn(async () => ({})) },
    campaignSubmission: { updateMany: jest.fn(async () => ({ count: 1 })) },
    onefopSubmission: {
      findFirst: jest.fn(async () => submissionTarget()),
      findMany: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
      count: jest.fn(async () => 0),
    },
    company: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    user: { findFirst: jest.fn(async () => activeAgent()), update: jest.fn(async () => ({})), groupBy: jest.fn(async () => []) },
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

describe('Phase 5 team workflow', () => {
  it('P5-1 claims a dossier for an active agent of the same territory and records the previous holder', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findFirst.mockResolvedValue(submissionTarget({ assigneeId: 'previous-agent' }));
    const service = new QuestionnairesService(prisma);

    const result = await service.assignSubmission('sub-1', 'agent-1', 'actor-a', regionalA);

    expect(prisma.onefopSubmission.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { assigneeId: 'agent-1' },
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'DOSSIER_ASSIGNED',
      resourceType: 'OnefopSubmission',
      resourceId: 'sub-1',
      details: {
        assigneeId: 'agent-1',
        assigneeName: 'Ada Ngo',
        previousAssigneeId: 'previous-agent',
        actorRole: 'REGIONAL_ADMIN',
      },
    });
    expect(result).toEqual({ id: 'sub-1', assigneeId: 'agent-1', assigneeName: 'Ada Ngo' });
  });

  it('P5-2 releases a dossier and refuses an assignee outside the file territory or not an agent', async () => {
    const prisma = transactionalPrisma();
    const service = new QuestionnairesService(prisma);

    const released = await service.assignSubmission('sub-1', null, 'actor-a', regionalA);
    expect(released.assigneeId).toBeNull();
    expect(prisma.onefopSubmission.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { assigneeId: null },
    });

    prisma.user.findFirst.mockResolvedValueOnce(activeAgent({ region: 'Littoral' }));
    await expect(service.assignSubmission('sub-1', 'agent-lt', 'actor-a', regionalA))
      .rejects.toThrow(ForbiddenException);

    prisma.user.findFirst.mockResolvedValueOnce(activeAgent({ role: 'COMPANY' }));
    await expect(service.assignSubmission('sub-1', 'company-1', 'actor-a', regionalA))
      .rejects.toThrow(BadRequestException);

    prisma.user.findFirst.mockResolvedValueOnce(activeAgent({ isActive: false }));
    await expect(service.assignSubmission('sub-1', 'suspended-1', 'actor-a', regionalA))
      .rejects.toThrow(BadRequestException);
  });

  it('P5-3 bulk correction only sends PENDING_REVIEW files back, audits each one and keeps the campaign in progress', async () => {
    const prisma = transactionalPrisma();
    prisma.onefopSubmission.findMany.mockResolvedValue([
      { id: 'pending-1', status: 'PENDING_REVIEW', region: 'Centre', department: 'Mf', campaignId: 'camp-1', establishmentId: 'est-1', companyId: null },
      { id: 'correction-1', status: 'CORRECTION_REQUESTED', region: 'Centre', department: 'Mf', campaignId: null, establishmentId: null, companyId: null },
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
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['pending-1'] }, status: 'PENDING_REVIEW' },
      data: expect.objectContaining({ status: 'CORRECTION_REQUESTED', reviewedBy: 'actor-n' }),
    });
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
          assigneeId: 'agent-1',
          assignee: { id: 'agent-1', firstName: 'Ada', lastName: 'Ngo', email: 'agent@onefop.cm' },
          campaign: null,
        }]),
        count: jest.fn(async () => 1),
      },
    };
    const questionnaires = new QuestionnairesService(prisma);
    const page = await questionnaires.listForAdmin({ limit: 10, offset: 0 }, national);
    expect(page.items[0].assigneeId).toBe('agent-1');
    expect(page.items[0].assigneeName).toBe('Ada Ngo');
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
    const auth = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    const assigned = await auth.assignRegistration('user-1', 'agent-1', 'actor-a', regionalA);
    expect(prisma.user.update).toHaveBeenCalledWith({
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
