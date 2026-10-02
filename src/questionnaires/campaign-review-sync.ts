// src/questionnaires/campaign-review-sync.ts
import { Logger } from '@nestjs/common';

/**
 * Campaign progress, phase B4 / Phase E.1. After a review action has set the
 * OnefopSubmission status, the matching CampaignSubmission row
 * (same campaignId, establishmentId) follows:
 *   approve / bulk visa                    -> VALIDATED (submittedAt unchanged)
 *   reject / bulk reject                   -> NOT_STARTED (submittedAt = null)
 *   request-correction                     -> IN_PROGRESS (submittedAt = null)
 *   submit                                 -> SUBMITTED (submittedAt = now)
 *   draft                                  -> IN_PROGRESS (submittedAt = null)
 *
 * No campaignId (submitted before B2, or no campaign round) or no establishmentId:
 * nothing to do.
 * updateMany (not update) so a missing row updates nothing, silently.
 * Best-effort, like B2: the review is already written, so a failure is
 * logged at error level and never rethrown.
 */
export type CampaignReviewStatus = 'VALIDATED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';

export async function syncCampaignSubmissionOnReview(
  prisma: any,
  logger: Logger,
  submission: { id: string; campaignId?: string | null; establishmentId?: string | null; companyId?: string | null },
  status: CampaignReviewStatus,
): Promise<void> {
  if (!submission.campaignId || !submission.establishmentId) return;

  try {
    await prisma.campaignSubmission.updateMany({
      where: { campaignId: submission.campaignId, establishmentId: submission.establishmentId },
      data: status === 'VALIDATED'
        ? { status }
        : status === 'SUBMITTED'
          ? { status, submittedAt: new Date() }
          : { status, submittedAt: null },
    });
  } catch (err: any) {
    logger.error(
      `Campaign progress update (${status}) failed for ONEFOP submission ${submission.id} ` +
      `(establishment ${submission.establishmentId}, campaign ${submission.campaignId})`,
      err?.stack,
    );
  }
}
