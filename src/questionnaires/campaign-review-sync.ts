// src/questionnaires/campaign-review-sync.ts
import { Logger } from '@nestjs/common';

/**
 * Campaign progress, phase B4 (docs/deferred.md, "Decision - campaign
 * progress is ONEFOP-only"). After a review action has set the
 * OnefopSubmission status, the matching CampaignSubmission row
 * (same campaignId, companyId) follows:
 *   approve / bulk visa                    -> VALIDATED (submittedAt unchanged)
 *   reject / bulk reject / request-correction -> PENDING  (submittedAt = null)
 *
 * No campaignId (submitted before B2, or no campaign round) or no companyId:
 * nothing to do. companyId is required because updateMany with
 * companyId: null would match establishment-keyed rows of the campaign.
 * updateMany (not update) so a missing row updates nothing, silently.
 * Best-effort, like B2: the review is already written, so a failure is
 * logged at error level and never rethrown.
 */
export type CampaignReviewStatus = 'VALIDATED' | 'PENDING';

export async function syncCampaignSubmissionOnReview(
  prisma: any,
  logger: Logger,
  submission: { id: string; campaignId?: string | null; companyId?: string | null },
  status: CampaignReviewStatus,
): Promise<void> {
  if (!submission.campaignId || !submission.companyId) return;
  try {
    await prisma.campaignSubmission.updateMany({
      where: { campaignId: submission.campaignId, companyId: submission.companyId },
      data: status === 'VALIDATED' ? { status } : { status, submittedAt: null },
    });
  } catch (err: any) {
    logger.error(
      `Campaign progress update (${status}) failed for ONEFOP submission ${submission.id} ` +
      `(company ${submission.companyId}, campaign ${submission.campaignId})`,
      err?.stack,
    );
  }
}
