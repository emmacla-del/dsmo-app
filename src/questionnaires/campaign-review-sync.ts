// src/questionnaires/campaign-review-sync.ts
import { Logger } from '@nestjs/common';

/**
 * Campaign progress, phase B4 / Phase E.1. After a review action has set the
 * OnefopSubmission status, the matching CampaignSubmission row
 * (same campaignId, establishmentId — falling back to companyId for legacy/bulk callers) follows:
 *   approve / bulk visa                    -> VALIDATED (submittedAt unchanged)
 *   reject / bulk reject                   -> NOT_STARTED (submittedAt = null)
 *   request-correction                     -> IN_PROGRESS (submittedAt = null)
 *   submit                                 -> SUBMITTED (submittedAt = now)
 *   draft                                  -> IN_PROGRESS (submittedAt = null)
 *
 * No campaignId (submitted before B2, or no campaign round) or no target:
 * nothing to do. establishmentId is preferred (E.1 multi-site target key),
 * with fallback to companyId if establishmentId is not present.
 * updateMany (not update) so a missing row updates nothing, silently.
 * Best-effort, like B2: the review is already written, so a failure is
 * logged at error level and never rethrown.
 */
export type CampaignReviewStatus = 'VALIDATED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';

export async function syncCampaignSubmissionOnReview(
  prisma: any,
  logger: Logger,
  submission: { id: string; campaignId?: string | null; companyId?: string | null; establishmentId?: string | null },
  status: CampaignReviewStatus,
): Promise<void> {
  if (!submission.campaignId) return;
  const where: { campaignId: string; establishmentId?: string; companyId?: string } = {
    campaignId: submission.campaignId,
  };
  if (submission.establishmentId) {
    where.establishmentId = submission.establishmentId;
  } else if (submission.companyId) {
    where.companyId = submission.companyId;
  } else {
    return;
  }

  try {
    await prisma.campaignSubmission.updateMany({
      where,
      data: status === 'VALIDATED'
        ? { status }
        : status === 'SUBMITTED'
          ? { status, submittedAt: new Date() }
          : { status, submittedAt: null },
    });
  } catch (err: any) {
    logger.error(
      `Campaign progress update (${status}) failed for ONEFOP submission ${submission.id} ` +
      `(${submission.establishmentId ? `establishment ${submission.establishmentId}` : `company ${submission.companyId}`}, campaign ${submission.campaignId})`,
      err?.stack,
    );
  }
}
