// src/questionnaires/pilotage-queue-counts.ts
//
// The database reads behind getPilotageQueues.
//
// The shell loads these figures on every admin page. They used to take eight
// Prisma queries in four steps, the slowest call on most screens. These two
// statements return the same figures, and run together: never more than two
// in flight, as the pooler requires (see getPilotageQueues).
import { Prisma } from '@prisma/client';

type RawReader = { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> };

/** A column, as the two statements alias the submission table. */
const COLUMNS: Record<string, Prisma.Sql> = {
  regionId: Prisma.sql`s."regionId"`,
  departmentId: Prisma.sql`s."departmentId"`,
  region: Prisma.sql`s.region`,
  department: Prisma.sql`s.department`,
};

/**
 * territoryWhere's answer, as SQL. Who sees what stays decided there alone;
 * this only spells the result. Geography is a security boundary (§14), so a
 * shape not recognised here is refused, never read as "no restriction".
 */
export function territorySql(scope: Record<string, unknown>): Prisma.Sql {
  const entries = Object.entries(scope);
  if (entries.length === 0) return Prisma.sql`TRUE`;
  const conditions = entries.map(([field, value]) => {
    const column = COLUMNS[field];
    if (field === 'id' && Array.isArray((value as any)?.in) && (value as any).in.length === 0) return Prisma.sql`FALSE`;
    if (column && typeof value === 'string') return Prisma.sql`${column} = ${value}`;
    const name = value as { equals?: unknown; mode?: unknown } | null;
    if (column && typeof name?.equals === 'string' && name.mode === 'insensitive') {
      return Prisma.sql`LOWER(${column}) = LOWER(${name.equals})`;
    }
    throw new Error(`Unknown territory filter: ${field}`);
  });
  return Prisma.join(conditions, ' AND ');
}

/** The columns are UTC without a zone; a Date parameter would carry one. */
function utc(date: Date): Prisma.Sql {
  return Prisma.sql`${date.toISOString()}::text::timestamp`;
}

/** One status and region of a territory's files. */
export interface QueueCountRow {
  status: string;
  region: string | null;
  files: number;
  blockingAnomalies: number;
  /** APPROVED files with no open blocking anomaly. */
  statisticallyReady: number;
}

/** Every count of a view. Drafts and replaced files follow the view's status set. */
export async function loadQueueCounts(
  prisma: RawReader,
  scope: Record<string, unknown>,
  view: 'queue' | 'completed' | 'all',
  includeArchived: boolean,
): Promise<QueueCountRow[]> {
  const status = view === 'completed'
    ? Prisma.sql`s.status::text IN ('APPROVED', 'REJECTED', 'SUPERSEDED')`
    : Prisma.sql`s.status::text NOT IN ('DRAFT', 'SUPERSEDED')`;
  const archive = includeArchived ? Prisma.sql`TRUE` : Prisma.sql`s."archivedAt" IS NULL`;
  return prisma.$queryRaw<QueueCountRow[]>(Prisma.sql`
    SELECT
      s.status::text AS status,
      s.region AS region,
      COUNT(*)::int AS files,
      COALESCE(SUM(open.blocking), 0)::int AS "blockingAnomalies",
      (COUNT(*) FILTER (WHERE s.status::text = 'APPROVED' AND open.blocking = 0))::int AS "statisticallyReady"
    FROM "onefop_submissions" s
    CROSS JOIN LATERAL (
      SELECT COUNT(*) AS blocking
      FROM "onefop_anomalies" a
      WHERE a."submissionId" = s.id AND a.status::text = 'OPEN' AND a."isBlocking"
    ) open
    WHERE ${territorySql(scope)} AND ${status} AND ${archive}
    GROUP BY s.status, s.region
  `);
}

/** The review pace of a territory, whatever the view. */
export interface ReviewPaceRow {
  oldestPending: Date | string | null;
  overdue: number;
  /** Days from submission to decision, one per file. */
  decidedDays: number[] | null;
}

/**
 * Files awaiting a decision, and those decided since `windowStart`. A decision
 * sets reviewedAt. A replaced file (SUPERSEDED) keeps the reviewedAt of the
 * correction request before it, so it counts. Reopening an endorsed file also
 * rewrites reviewedAt, to the reopening: those files are left out, as their
 * reviewedAt is no longer a decision.
 */
export async function loadReviewPace(
  prisma: RawReader,
  scope: Record<string, unknown>,
  overdueBefore: Date,
  windowStart: Date,
  includeArchived = false,
): Promise<ReviewPaceRow> {
  const territory = territorySql(scope);
  const archive = includeArchived ? Prisma.sql`TRUE` : Prisma.sql`s."archivedAt" IS NULL`;
  const rows = await prisma.$queryRaw<ReviewPaceRow[]>(Prisma.sql`
    SELECT pending."oldestPending", pending.overdue, decided."decidedDays"
    FROM (
      SELECT
        MIN(s."submissionDate") AS "oldestPending",
        (COUNT(*) FILTER (WHERE s."submissionDate" < ${utc(overdueBefore)}))::int AS overdue
      FROM "onefop_submissions" s
      WHERE ${territory} AND s.status::text = 'PENDING_REVIEW' AND ${archive}
    ) pending
    CROSS JOIN (
      SELECT array_agg(
        GREATEST(EXTRACT(EPOCH FROM (s."reviewedAt" - s."submissionDate")), 0)::float8 / 86400
      ) AS "decidedDays"
      FROM "onefop_submissions" s
      WHERE ${territory}
        AND s.status::text IN ('APPROVED', 'REJECTED', 'CORRECTION_REQUESTED', 'SUPERSEDED')
        AND s."reviewedAt" >= ${utc(windowStart)}
        AND ${archive}
        AND NOT EXISTS (
          SELECT 1 FROM "audit_logs" reopening
          WHERE reopening.action = 'AUDIT_REOPEN'
            AND reopening."resourceType" = 'OnefopSubmission'
            AND reopening."resourceId" = s.id
            AND reopening.timestamp >= ${utc(windowStart)}
        )
    ) decided
  `);
  return rows[0];
}
