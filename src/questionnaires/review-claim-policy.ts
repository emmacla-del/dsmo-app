import { OnefopStatus } from '@prisma/client';

/** Only these workflow states can be held by a reviewer. */
export const CLAIMABLE_REVIEW_STATUSES = [
  OnefopStatus.PENDING_REVIEW,
  OnefopStatus.CORRECTION_REQUESTED,
] as const;

export const CLAIM_ASSIGNMENT_AUDIT_ACTION = 'DOSSIER_ASSIGNED';
export const CLAIM_PROGRESS_AUDIT_ACTION = 'DOSSIER_REVIEW_PROGRESS_SAVED';
export const CLAIM_EXPIRED_AUDIT_ACTION = 'DOSSIER_CLAIM_EXPIRED';

export interface ClaimableSubmission {
  id: string;
  status: OnefopStatus | string;
  assigneeId: string | null;
  claimActivityAt?: Date | null;
  archivedAt?: Date | null;
}

export interface EffectiveClaimState {
  eligible: boolean;
  assigneeId: string | null;
  expired: boolean;
  activityTracked: boolean;
  lastActivityAt: Date | null;
  expiresAt: Date | null;
}

/**
 * Length of a review claim. Since 2026-11-09 (owner, CLAUDE.md §21) the clock
 * is FIXED from the claim: claimActivityAt is the time of the claim and saving
 * progress no longer moves it, so a submission must be decided within 12 hours
 * of being claimed, round the clock. The names keep their historical
 * "inactivity" wording (and the env variable its name) so existing
 * configuration still applies.
 */
export function claimInactivityMs(env: NodeJS.ProcessEnv = process.env): number {
  const configuredHours = Number(env.ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS ?? 12);
  const hours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 12;
  return hours * 60 * 60 * 1000;
}

/** Inclusive expiry boundary shared by the SQL-backed list predicate and row projection. */
export function claimActivityCutoff(now: Date): Date {
  return new Date(now.getTime() - claimInactivityMs());
}

/**
 * Project effective ownership from the persisted row state. NULL activity is
 * deliberately untracked legacy ownership: keep the raw owner active until a
 * real claim/progress write establishes a trustworthy activity time.
 */
export function getEffectiveClaimState(
  submission: ClaimableSubmission,
  now = new Date(),
): EffectiveClaimState {
  const eligible = !submission.archivedAt &&
    (CLAIMABLE_REVIEW_STATUSES as readonly string[]).includes(submission.status);
  if (!eligible || !submission.assigneeId) {
    return {
      eligible,
      assigneeId: null,
      expired: false,
      activityTracked: false,
      lastActivityAt: null,
      expiresAt: null,
    };
  }

  const lastActivityAt = submission.claimActivityAt ?? null;
  if (!lastActivityAt) {
    return {
      eligible: true,
      assigneeId: submission.assigneeId,
      expired: false,
      activityTracked: false,
      lastActivityAt: null,
      expiresAt: null,
    };
  }

  const expiresAt = new Date(lastActivityAt.getTime() + claimInactivityMs());
  const expired = now.getTime() >= expiresAt.getTime();
  return {
    eligible: true,
    assigneeId: expired ? null : submission.assigneeId,
    expired,
    activityTracked: true,
    lastActivityAt,
    expiresAt,
  };
}

/** Batch projection stays in-process because each row now carries claimActivityAt. */
export function getEffectiveClaimStatesBatch(
  submissions: ClaimableSubmission[],
  now = new Date(),
): Map<string, EffectiveClaimState> {
  return new Map(submissions.map((submission) => [submission.id, getEffectiveClaimState(submission, now)]));
}
