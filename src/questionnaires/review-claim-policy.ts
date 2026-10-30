import { OnefopStatus } from '@prisma/client';

/** Only these workflow states can be held by a reviewer. */
export const CLAIMABLE_REVIEW_STATUSES = [
  OnefopStatus.PENDING_REVIEW,
  OnefopStatus.CORRECTION_REQUESTED,
] as const;

export const CLAIM_ASSIGNMENT_AUDIT_ACTION = 'DOSSIER_ASSIGNED';
export const CLAIM_PROGRESS_AUDIT_ACTION = 'DOSSIER_REVIEW_PROGRESS_SAVED';
export const CLAIM_EXPIRED_AUDIT_ACTION = 'DOSSIER_CLAIM_EXPIRED';
const CLAIM_ACTIVITY_ACTIONS = [CLAIM_ASSIGNMENT_AUDIT_ACTION, CLAIM_PROGRESS_AUDIT_ACTION];

/**
 * Read-only compatibility adapter for the pre-migration schema. Audit rows
 * are the durable activity ledger until OnefopSubmission.claimActivityAt is
 * added. updatedAt is deliberately used only as a compare-and-swap revision,
 * never as the inactivity clock.
 */
export interface ClaimActivityReader {
  auditLog: {
    findFirst(args: unknown): Promise<{
      action: string;
      userId: string;
      timestamp: Date;
      details: unknown;
    } | null>;
  };
}

export interface ClaimableSubmission {
  id: string;
  status: OnefopStatus | string;
  assigneeId: string | null;
  archivedAt?: Date | null;
  updatedAt?: Date | null;
}

export interface EffectiveClaimState {
  eligible: boolean;
  assigneeId: string | null;
  expired: boolean;
  activityTracked: boolean;
  lastActivityAt: Date | null;
  expiresAt: Date | null;
}

export function claimInactivityMs(env: NodeJS.ProcessEnv = process.env): number {
  const configuredHours = Number(env.ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS ?? 12);
  const hours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 12;
  return hours * 60 * 60 * 1000;
}

function eventOwner(event: { action: string; userId: string; details: unknown }): string | null {
  if (!event.details || typeof event.details !== 'object') return null;
  const details = event.details as Record<string, unknown>;
  if (event.action === CLAIM_ASSIGNMENT_AUDIT_ACTION) {
    return typeof details.assigneeId === 'string' ? details.assigneeId : null;
  }
  const ownerId = details.ownerId;
  return typeof ownerId === 'string' ? ownerId : event.userId;
}

/**
 * Returns the latest durable activity only when it belongs to this current
 * assignment generation. Missing history means a legacy, untracked claim:
 * it remains effective until the Phase 2 backfill makes its age knowable.
 */
export async function getClaimActivityAt(
  reader: ClaimActivityReader,
  submissionId: string,
  assigneeId: string,
): Promise<Date | null> {
  const event = await reader.auditLog.findFirst({
    where: {
      resourceType: 'OnefopSubmission',
      resourceId: submissionId,
      action: { in: CLAIM_ACTIVITY_ACTIONS },
    },
    orderBy: { timestamp: 'desc' },
    select: { action: true, userId: true, timestamp: true, details: true },
  });
  if (!event || eventOwner(event) !== assigneeId) return null;
  return event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp);
}

export async function getEffectiveClaimState(
  reader: ClaimActivityReader,
  submission: ClaimableSubmission,
  now = new Date(),
): Promise<EffectiveClaimState> {
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

  const lastActivityAt = await getClaimActivityAt(reader, submission.id, submission.assigneeId);
  if (!lastActivityAt) {
    return {
      eligible,
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
    eligible,
    assigneeId: expired ? null : submission.assigneeId,
    expired,
    activityTracked: true,
    lastActivityAt,
    expiresAt,
  };
}
