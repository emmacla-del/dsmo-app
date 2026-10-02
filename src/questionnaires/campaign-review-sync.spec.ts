import { Logger } from '@nestjs/common';
import { syncCampaignSubmissionOnReview } from './campaign-review-sync';

describe('syncCampaignSubmissionOnReview (Phase E.1)', () => {
  let prisma: any;
  let logger: Logger;

  beforeEach(() => {
    prisma = {
      campaignSubmission: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    } as any;
  });

  it('updates by establishmentId when establishmentId is present', async () => {
    await syncCampaignSubmissionOnReview(
      prisma,
      logger,
      { id: 'sub-1', campaignId: 'camp-1', establishmentId: 'est-uuid-1' },
      'VALIDATED',
    );

    expect(prisma.campaignSubmission.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'camp-1', establishmentId: 'est-uuid-1' },
      data: { status: 'VALIDATED' },
    });
  });

  it('does nothing when establishmentId is omitted (no companyId fallback)', async () => {
    await syncCampaignSubmissionOnReview(
      prisma,
      logger,
      { id: 'sub-1', campaignId: 'camp-1', companyId: 'comp-1' },
      'SUBMITTED',
    );

    expect(prisma.campaignSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('does nothing when campaignId is null/missing', async () => {
    await syncCampaignSubmissionOnReview(
      prisma,
      logger,
      { id: 'sub-1', campaignId: null, establishmentId: 'est-uuid-1' },
      'NOT_STARTED',
    );

    expect(prisma.campaignSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('swallows errors and logs with error level', async () => {
    prisma.campaignSubmission.updateMany.mockRejectedValue(new Error('DB failure'));

    await expect(
      syncCampaignSubmissionOnReview(
        prisma,
        logger,
        { id: 'sub-1', campaignId: 'camp-1', establishmentId: 'est-uuid-1' },
        'IN_PROGRESS',
      ),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Campaign progress update (IN_PROGRESS) failed for ONEFOP submission sub-1'),
      expect.any(String),
    );
  });
});
