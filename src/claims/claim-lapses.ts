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

export interface ClaimLapseCount {
  registrations: number;
  submissions: number;
}

interface AuditGroupClient {
  auditLog: {
    groupBy(args: unknown): Promise<Array<{ userId: string; action: string; _count: { _all: number } }>>;
  };
}

/** One grouped read: lapses per officer in [start, end], by kind. */
export async function countClaimLapses(
  prisma: AuditGroupClient,
  userIds: string[],
  start: Date,
  end: Date,
): Promise<Map<string, ClaimLapseCount>> {
  const counts = new Map<string, ClaimLapseCount>(userIds.map((id) => [id, { registrations: 0, submissions: 0 }]));
  if (userIds.length === 0) return counts;
  const rows = await prisma.auditLog.groupBy({
    by: ['userId', 'action'],
    where: {
      userId: { in: userIds },
      action: { in: [...CLAIM_LAPSE_ACTIONS] },
      timestamp: { gte: start, lte: end },
      details: { path: ['reason'], equals: 'DEADLINE' },
    },
    _count: { _all: true },
  });
  for (const row of rows) {
    const count = counts.get(row.userId);
    if (!count) continue;
    if (row.action === REGISTRATION_CLAIM_EXPIRED_AUDIT_ACTION) count.registrations += row._count._all;
    else count.submissions += row._count._all;
  }
  return counts;
}
