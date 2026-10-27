import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuestionnairesService } from './questionnaires.service';

/**
 * Defect 13 (2026-10-16 VT run): an endorsed file could never be returned for
 * correction. reopenForCorrection lets central admins and submission admins withdraw
 * an endorsement, with a reason, an attestation and an audit entry, while the
 * file's period is still open; the file then follows the correction flow.
 */
const territory = (role: string) => ({ role, region: 'Littoral', department: 'Wouri', regionId: null, departmentId: null }) as any;

const REVISION = new Date('2026-10-27T09:30:00.000Z');

function setup({ status = 'APPROVED', roundOpen = true } = {}) {
  const submission = {
    id: 'db-1',
    status,
    quarterCode: 'QUARTERLY_2026_T4_001',
    campaignId: 'camp-1',
    establishmentId: 'est-1',
    companyId: 'co-1',
    region: 'Littoral',
    regionId: null,
    department: 'Wouri',
    departmentId: null,
    updatedAt: REVISION,
  };
  let written: Record<string, unknown> = {};
  const prisma: any = {
    onefopSubmission: {
      findFirst: jest.fn().mockResolvedValue(submission),
      updateMany: jest.fn().mockImplementation(({ data }) => {
        written = data;
        return Promise.resolve({ count: 1 });
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ ...submission, ...written, id: where.id })),
    },
    submissionRound: { findFirst: jest.fn().mockResolvedValue(roundOpen ? { id: 'round-1' } : null) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    campaignSubmission: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  prisma.$transaction = jest.fn().mockImplementation((cb: any) => cb(prisma));
  const service = new QuestionnairesService(prisma);
  return { service, prisma };
}

const REASON = 'Effectifs 4.2 erronés, à reprendre.';

describe('QuestionnairesService.reopenForCorrection', () => {
  it('returns an endorsed file for correction, with the reason, and records AUDIT_REOPEN', async () => {
    const { service, prisma } = setup();
    const updated: any = await service.reopenForCorrection(
      'db-1', REASON, true, 'admin-1', territory('ADMIN_ONEFOP'), REVISION.toISOString(),
    );

    expect(updated.status).toBe('CORRECTION_REQUESTED');
    expect(prisma.onefopSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: 'db-1', status: 'APPROVED', updatedAt: REVISION },
      data: expect.objectContaining({ status: 'CORRECTION_REQUESTED', rejectionReason: REASON, reviewedBy: 'admin-1' }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'AUDIT_REOPEN',
        resourceId: 'db-1',
        details: expect.objectContaining({ reason: REASON, previousStatus: 'APPROVED', newStatus: 'CORRECTION_REQUESTED', certified: true }),
      }),
    });
    // The campaign's progress counts the file as in progress again.
    expect(prisma.campaignSubmission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }),
    );
  });

  it('is open to SUPER_ADMIN too', async () => {
    const { service } = setup();
    await expect(
      service.reopenForCorrection('db-1', REASON, true, 'sa-1', territory('SUPER_ADMIN'), REVISION.toISOString()),
    ).resolves.toBeTruthy();
  });

  it('is open to the submissions administrator', async () => {
    const { service } = setup();
    await expect(
      service.reopenForCorrection(
        'db-1', REASON, true, 'sub-admin-1', territory('ADMIN_ONEFOP_SUBMISSIONS'), REVISION.toISOString(),
      ),
    ).resolves.toBeTruthy();
  });

  it('refuses every other role, before reading the file', async () => {
    for (const role of ['ADMIN_ONEFOP_REGISTRATIONS', 'REGIONAL_ADMIN', 'DIVISIONAL_ADMIN', 'CENTRAL_AGENT', 'COMPANY']) {
      const { service, prisma } = setup();
      await expect(service.reopenForCorrection('db-1', REASON, true, 'x', territory(role))).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.onefopSubmission.findFirst).not.toHaveBeenCalled();
      expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    }
    const { service } = setup();
    await expect(service.reopenForCorrection('db-1', REASON, true, 'x', undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the attestation and a reason of at least 10 characters', async () => {
    const { service, prisma } = setup();
    await expect(service.reopenForCorrection('db-1', REASON, false, 'a', territory('SUPER_ADMIN'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reopenForCorrection('db-1', '  court  ', true, 'a', territory('SUPER_ADMIN'))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('reopens endorsed files only', async () => {
    for (const status of ['PENDING_REVIEW', 'CORRECTION_REQUESTED', 'REJECTED', 'DRAFT']) {
      const { service, prisma } = setup({ status });
      await expect(
        service.reopenForCorrection('db-1', REASON, true, 'a', territory('SUPER_ADMIN'), REVISION.toISOString()),
      ).rejects.toThrow(/Seul un dossier visé/);
      expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    }
  });

  it('refuses when the period is closed: the respondent could not resubmit', async () => {
    const { service, prisma } = setup({ roundOpen: false });
    await expect(
      service.reopenForCorrection('db-1', REASON, true, 'a', territory('SUPER_ADMIN'), REVISION.toISOString()),
    ).rejects.toThrow(/n'est plus ouverte/);
    expect(prisma.submissionRound.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ quarterCode: 'QUARTERLY_2026_T4_001' }) }),
    );
    expect(prisma.onefopSubmission.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
