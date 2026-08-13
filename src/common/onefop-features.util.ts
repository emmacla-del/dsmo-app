// src/common/onefop-features.util.ts
//
// Single source of truth for ONEFOP-approval-derived feature eligibility
// (onefopBasicAnalytics / onefopBenchmarking / etc).
//
// These flags are attached to the HTTP response body at login/getMe time
// (see AuthService.buildFeatures) so the Flutter app can gate its own UI —
// but they are NEVER encoded into the JWT itself. A later authenticated
// request only carries { id, email, role, region, department } on
// req.user (see JwtStrategy.validate). Any endpoint that needs to enforce
// one of these gates must recompute it here from the database — reading
// req.user.features or req.user.sub silently resolves to undefined and
// was the root cause of company-summary/company-benchmarks always
// returning 403, regardless of actual approval status.

import { PrismaService } from '../prisma/prisma.service';

export interface OnefopFeatures {
  onefopBasicAnalytics: boolean;
  onefopBenchmarking: boolean;
  onefopSubmissionStatus: string | null;
  onefopSurveyYear: number | null;
  onefopSubmissionDate: Date | null;
  onefopHasDraft: boolean;
}

/**
 * Scoped by companyId rather than the submitting userId — equivalent in
 * practice (Company.userId is @unique, so a company has exactly one owning
 * user) but usable directly by callers that already resolved a companyId,
 * like AnalyticsController.
 */
export async function computeOnefopFeatures(
  prisma: PrismaService,
  companyId: string,
): Promise<OnefopFeatures> {
  const onefopSubs = await (prisma as any).onefopSubmission.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    select: { status: true, surveyYear: true, submissionDate: true },
  });

  const latestSubmitted = onefopSubs.find((s: any) =>
    ['PENDING_REVIEW', 'APPROVED'].includes(s.status),
  );

  return {
    onefopBasicAnalytics: !!latestSubmitted,
    // Unlocks as soon as the ONEFOP questionnaire is submitted, same
    // threshold as onefopBasicAnalytics — previously required a full
    // APPROVED status, which meant a company got no reciprocal value
    // (peer comparison) until after a review cycle it can't control the
    // timing of. Safe to loosen: getCompanyBenchmarks already reports a
    // clear NO_OWN_DATA/INSUFFICIENT_DATA state rather than a misleading
    // comparison when the underlying DSMO declaration data isn't there
    // yet, so this just lets more companies reach that (already-honest)
    // gate sooner instead of hitting a closed door first.
    onefopBenchmarking: !!latestSubmitted,
    onefopSubmissionStatus: latestSubmitted?.status ?? null,
    onefopSurveyYear: latestSubmitted?.surveyYear ?? null,
    onefopSubmissionDate: latestSubmitted?.submissionDate ?? null,
    onefopHasDraft: onefopSubs.some((s: any) => s.status === 'DRAFT'),
  };
}
