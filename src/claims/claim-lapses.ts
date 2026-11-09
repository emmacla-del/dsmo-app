import { REGISTRATION_CLAIM_EXPIRED_AUDIT_ACTION } from '../auth/registration-claim-policy';
import { CLAIM_EXPIRED_AUDIT_ACTION } from '../questionnaires/review-claim-policy';

/**
 * The negative signal for a claim that lapsed before a decision (CLAUDE.md
 * §21, 2026-11-09). There is no table of its own: every lapse is an audit row
 * written when the claim is released, with `userId` the officer who held it
 * and `details.reason` 'DEADLINE'. Rows written before the deadline existed
 * carry 'INACTIVITY' and are not counted: they record a different rule.
 *
 * Shown to the officer and to their supervisors (national admins, the
 * délégué of their territory), never to colleagues.
 */
export const CLAIM_LAPSE_ACTIONS = [REGISTRATION_CLAIM_EXPIRED_AUDIT_ACTION, CLAIM_EXPIRED_AUDIT_ACTION] as const;

/** The reviewer's own line looks back this far. */
export const OWN_LAPSE_WINDOW_DAYS = 30;

/**
 * A claim taken before the deadline rule was in force cannot have missed it.
 * When the rule is deployed, the first sweep releases every older claim at
 * once (and the registration backfill dates a claim from its last
 * assignment), all with reason DEADLINE: those releases are correct, but
 * they are not misses, so they are not counted. A lapse counts when the claim
 * it ends was taken at or after this instant (`details.claimedAt`; the time
 * of the release when a row records none). Default: the day after the rule
 * was approved, so no claim taken under the old rule is held against anyone;
 * ONEFOP_CLAIM_SIGNAL_FROM (ISO date) sets it to the actual deployment time.
 */
export function claimSignalFrom(env: NodeJS.ProcessEnv = process.env): Date {
  const configured = env.ONEFOP_CLAIM_SIGNAL_FROM ? new Date(env.ONEFOP_CLAIM_SIGNAL_FROM) : null;
  return configured && !Number.isNaN(configured.getTime()) ? configured : new Date('2026-11-10T00:00:00.000Z');
}

export interface ClaimLapseCount {
  registrations: number;
  submissions: number;
}

interface AuditReadClient {
  auditLog: {
    findMany(args: unknown): Promise<Array<{ userId: string; action: string; timestamp: Date; details: unknown }>>;
  };
}

/**
 * Lapses per officer in [start, end], by kind. Reads the rows rather than
 * grouping them, because whether one counts depends on details.claimedAt,
 * which a JSON filter cannot compare as a date; lapses are few.
 */
export async function countClaimLapses(
  prisma: AuditReadClient,
  userIds: string[],
  start: Date,
  end: Date,
  signalFrom: Date = claimSignalFrom(),
): Promise<Map<string, ClaimLapseCount>> {
  const counts = new Map<string, ClaimLapseCount>(userIds.map((id) => [id, { registrations: 0, submissions: 0 }]));
  if (userIds.length === 0) return counts;
  const rows = await prisma.auditLog.findMany({
    where: {
      userId: { in: userIds },
      action: { in: [...CLAIM_LAPSE_ACTIONS] },
      timestamp: { gte: start > signalFrom ? start : signalFrom, lte: end },
      details: { path: ['reason'], equals: 'DEADLINE' },
    },
    select: { userId: true, action: true, timestamp: true, details: true },
  });
  for (const row of rows) {
    const count = counts.get(row.userId);
    if (!count) continue;
    const claimedAtRaw = (row.details as { claimedAt?: unknown } | null)?.claimedAt;
    const claimedAt = typeof claimedAtRaw === 'string' ? new Date(claimedAtRaw) : null;
    const takenAt = claimedAt && !Number.isNaN(claimedAt.getTime()) ? claimedAt : row.timestamp;
    if (takenAt < signalFrom) continue;
    if (row.action === REGISTRATION_CLAIM_EXPIRED_AUDIT_ACTION) count.registrations += 1;
    else if (row.action === CLAIM_EXPIRED_AUDIT_ACTION) count.submissions += 1;
  }
  return counts;
}
