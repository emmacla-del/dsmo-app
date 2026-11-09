/**
 * Claim deadline for a pending registration (owner, CLAUDE.md §21,
 * 2026-11-09): the officer who claims a registration has 2 hours from the
 * claim, round the clock, to decide it. Past that the claim is released to
 * the queue and the miss is recorded against the officer
 * (REGISTRATION_CLAIM_EXPIRED). The clock is fixed: nothing the officer does
 * short of a decision extends it, and claiming the file again after it
 * lapsed starts a new clock but does not erase the miss.
 *
 * Only a PENDING_APPROVAL file is on the clock. A file sent back for
 * complements waits on the declarant; its holder gets a fresh clock when the
 * declarant resubmits.
 */
export const REGISTRATION_CLAIM_EXPIRED_AUDIT_ACTION = 'REGISTRATION_CLAIM_EXPIRED';

const DEFAULT_REGISTRATION_CLAIM_HOURS = 2;

export function registrationClaimMs(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.ONEFOP_REGISTRATION_CLAIM_HOURS ?? DEFAULT_REGISTRATION_CLAIM_HOURS);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REGISTRATION_CLAIM_HOURS;
  return hours * 60 * 60 * 1000;
}

/** A claim made at or before this moment has lapsed. */
export function registrationClaimCutoff(now: Date): Date {
  return new Date(now.getTime() - registrationClaimMs());
}

export interface RegistrationClaimRow {
  status: string;
  assigneeId?: string | null;
  registrationClaimedAt?: Date | null;
}

export interface RegistrationClaimState {
  /** Who holds the file now; null once the claim has lapsed. */
  assigneeId: string | null;
  expired: boolean;
  /** When the claim lapses; null when no clock runs (free, decided, or untimed). */
  expiresAt: Date | null;
}

export function registrationClaimState(row: RegistrationClaimRow, now = new Date()): RegistrationClaimState {
  const holder = row.assigneeId ?? null;
  if (!holder || row.status !== 'PENDING_APPROVAL' || !row.registrationClaimedAt) {
    return { assigneeId: holder, expired: false, expiresAt: null };
  }
  const expiresAt = new Date(row.registrationClaimedAt.getTime() + registrationClaimMs());
  const expired = now.getTime() >= expiresAt.getTime();
  return { assigneeId: expired ? null : holder, expired, expiresAt };
}

/**
 * Prisma where-fragments on the User row. A lapsed claim is no claim: it is
 * listed with the free files, never under its former holder.
 */
export function freeRegistrationWhere(now: Date) {
  return {
    OR: [
      { assigneeId: null },
      { status: 'PENDING_APPROVAL' as const, registrationClaimedAt: { lte: registrationClaimCutoff(now) } },
    ],
  };
}

export function liveRegistrationClaimWhere(now: Date) {
  return {
    OR: [
      { status: { not: 'PENDING_APPROVAL' as const } },
      { registrationClaimedAt: null },
      { registrationClaimedAt: { gt: registrationClaimCutoff(now) } },
    ],
  };
}
