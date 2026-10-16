import { ConflictException } from '@nestjs/common';
import { OnefopService, samePeriodCodes } from './onefop.service';

/**
 * 2026-10-16, defect 1 of the VT end-to-end run: after submission the wizard
 * reopened from the server draft and wrote it back. POST /onefop/draft now
 * refuses while the period's declaration is awaiting review or endorsed; a
 * file returned for correction, or rejected, stays editable.
 */
describe('OnefopService.saveDraft on a submitted declaration', () => {
  const setup = (live: { id: string } | null) => {
    const prisma: any = {
      company: { findFirst: jest.fn(async () => ({ id: 'c1', establishmentId: 'e1' })) },
      onefopSubmission: { findFirst: jest.fn(async () => live) },
      submissionDraft: { upsert: jest.fn(async () => ({ id: 'd1' })) },
    };
    return { prisma, service: new OnefopService(prisma, {} as any) };
  };
  const params = { quarterCode: 'QUARTERLY_2026_T4_001', entityType: 'VOCATIONAL_TRAINING', draftData: { VT1_2: 'x' } };

  it('refuses while a declaration of the period is pending review or endorsed', async () => {
    const { prisma, service } = setup({ id: 's1' });
    await expect(service.saveDraft('u1', params)).rejects.toThrow(ConflictException);
    expect(prisma.submissionDraft.upsert).not.toHaveBeenCalled();
    const where = prisma.onefopSubmission.findFirst.mock.calls[0][0].where;
    expect(where.companyId).toBe('c1');
    expect(where.status).toEqual({ in: ['PENDING_REVIEW', 'APPROVED'] });
    expect(where.quarterCode).toEqual({ in: ['QUARTERLY_2026_T4_001', '2026-T4'] });
  });

  it('saves when there is none (draft, correction requested and rejected do not count)', async () => {
    const { prisma, service } = setup(null);
    await service.saveDraft('u1', params);
    expect(prisma.submissionDraft.upsert).toHaveBeenCalledTimes(1);
  });

  it('samePeriodCodes pairs a quarterly campaign code with its fallback code only', () => {
    expect(samePeriodCodes('QUARTERLY_2026_T4_001')).toEqual(['QUARTERLY_2026_T4_001', '2026-T4']);
    expect(samePeriodCodes('2026-T4')).toEqual(['2026-T4']);
    expect(samePeriodCodes('ANNUAL_2026_AN_001')).toEqual(['ANNUAL_2026_AN_001']);
    expect(samePeriodCodes(null)).toEqual([]);
  });
});
