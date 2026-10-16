import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuestionnairesService } from './questionnaires.service';

/**
 * Defect 13 (2026-10-16 VT run): an endorsed file could never be returned for
 * correction. reopenForCorrection lets the two central ONEFOP roles withdraw
 * an endorsement, with a reason, an attestation and an audit entry, while the
 * file's period is still open; the file then follows the correction flow.
 */
const territory = (role: string) => ({ role, region: 'Littoral', department: 'Wouri', regionId: null, departmentId: null }) as any;

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
  };
  const prisma = {
    onefopSubmission: {
      findFirst: jest.fn().mockResolvedValue(submission),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...submission, ...data })),
    },
    submissionRound: { findFirst: jest.fn().mockResolvedValue(roundOpen ? { id: 'round-1' } : null) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    campaignSubmission: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const service = new QuestionnairesService(prisma as any);
  return { service, prisma };
}

const REASON = 'Effectifs 4.2 erronés, à reprendre.';

describe('QuestionnairesService.reopenForCorrection', () => {
  it('returns an endorsed file for correction, with the reason, and records AUDIT_REOPEN', async () => {
    const { service, prisma } = setup();
    const updated: any = await service.reopenForCorrection('db-1', REASON, true, 'admin-1', territory('ADMIN_ONEFOP'));

    expect(updated.status).toBe('CORRECTION_REQUESTED');
    expect(prisma.onefopSubmission.update).toHaveBeenCalledWith({
      where: { id: 'db-1' },
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
    await expect(service.reopenForCorrection('db-1', REASON, true, 'sa-1', territory('SUPER_ADMIN'))).resolves.toBeTruthy();
  });

  it('refuses every other role, before reading the file', async () => {
    for (const role of ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN', 'CENTRAL_AGENT', 'COMPANY']) {
      const { service, prisma } = setup();
      await expect(service.reopenForCorrection('db-1', REASON, true, 'x', territory(role))).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.onefopSubmission.findFirst).not.toHaveBeenCalled();
      expect(prisma.onefopSubmission.update).not.toHaveBeenCalled();
    }
    const { service } = setup();
    await expect(service.reopenForCorrection('db-1', REASON, true, 'x', undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the attestation and a reason of at least 10 characters', async () => {
    const { service, prisma } = setup();
    await expect(service.reopenForCorrection('db-1', REASON, false, 'a', territory('SUPER_ADMIN'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.reopenForCorrection('db-1', '  court  ', true, 'a', territory('SUPER_ADMIN'))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.onefopSubmission.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('reopens endorsed files only', async () => {
    for (const status of ['PENDING_REVIEW', 'CORRECTION_REQUESTED', 'REJECTED', 'DRAFT']) {
      const { service, prisma } = setup({ status });
      await expect(service.reopenForCorrection('db-1', REASON, true, 'a', territory('SUPER_ADMIN'))).rejects.toThrow(/Seul un dossier visé/);
      expect(prisma.onefopSubmission.update).not.toHaveBeenCalled();
    }
  });

  it('refuses when the period is closed: the respondent could not resubmit', async () => {
    const { service, prisma } = setup({ roundOpen: false });
    await expect(service.reopenForCorrection('db-1', REASON, true, 'a', territory('SUPER_ADMIN'))).rejects.toThrow(/n'est plus ouverte/);
    expect(prisma.submissionRound.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ quarterCode: 'QUARTERLY_2026_T4_001' }) }),
    );
    expect(prisma.onefopSubmission.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
