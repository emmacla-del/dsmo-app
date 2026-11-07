/**
 * Postgres-level check of the queue counts.
 *
 * WHY THIS FILE EXISTS. loadQueueCounts and loadReviewPace are hand-written SQL
 * over a security boundary, and the unit tests mock them. Here each figure is
 * read a second way, through the Prisma queries getPilotageQueues used to run,
 * for each kind of territory, and the two must agree.
 *
 * SAFETY. Reads only. A mismatch reports the territory, view and field, and
 * counts only.
 *
 * OPT-IN. Skipped unless PG_INTEGRATION=1. Run it with `npm run test:pg`.
 */
import { OnefopStatus, PrismaClient } from '@prisma/client';
import { Territory, territoryWhere } from '../auth/territory';
import { archiveReadPredicate, archiveState } from '../common/archive-predicate';
import { loadQueueCounts, loadReviewPace } from './pilotage-queue-counts';

const ENABLED = process.env.PG_INTEGRATION === '1';
const describePg = ENABLED ? describe : describe.skip;
const DAY_MS = 24 * 60 * 60 * 1000;

describePg('queue counts against Postgres', () => {
  const prisma = new PrismaClient();
  // As PrismaService runs it: the raw statements never pass through this.
  prisma.$use(archiveReadPredicate as any);
  afterAll(() => prisma.$disconnect());

  async function viaPrisma(territory: Territory, view: 'queue' | 'completed', includeArchived: boolean) {
    const status = view === 'completed'
      ? { status: { in: [OnefopStatus.APPROVED, OnefopStatus.REJECTED, OnefopStatus.SUPERSEDED] } }
      : { status: { notIn: [OnefopStatus.DRAFT, OnefopStatus.SUPERSEDED] } };
    const where: any = { AND: [territoryWhere(territory), status, archiveState(includeArchived)] };
    const groups = await prisma.onefopSubmission.groupBy({ by: ['status', 'region'], where, _count: { _all: true } });
    return {
      groups: groups.map((g) => `${g.status}|${g.region}|${g._count._all}`).sort(),
      blocking: await prisma.onefopAnomaly.count({ where: { status: 'OPEN', isBlocking: true, submission: where } }),
      ready: await prisma.onefopSubmission.count({
        where: { ...where, status: OnefopStatus.APPROVED, anomalies: { none: { status: 'OPEN', isBlocking: true } } },
      }),
    };
  }

  async function paceViaPrisma(territory: Territory, overdueBefore: Date, windowStart: Date) {
    const pending = { AND: [territoryWhere(territory), { status: OnefopStatus.PENDING_REVIEW }, { archivedAt: null }] };
    const oldest = await prisma.onefopSubmission.aggregate({ where: pending, _min: { submissionDate: true } });
    const overdue = await prisma.onefopSubmission.count({
      where: { AND: [...pending.AND, { submissionDate: { lt: overdueBefore } }] },
    });
    const decided = await prisma.onefopSubmission.findMany({
      where: {
        AND: [
          territoryWhere(territory),
          { status: { in: [OnefopStatus.APPROVED, OnefopStatus.REJECTED, OnefopStatus.CORRECTION_REQUESTED, OnefopStatus.SUPERSEDED] } },
          { reviewedAt: { gte: windowStart } },
          { archivedAt: null },
        ],
      },
      select: { id: true, submissionDate: true, reviewedAt: true },
    });
    const reopenings = await prisma.auditLog.findMany({
      where: { action: 'AUDIT_REOPEN', resourceType: 'OnefopSubmission', timestamp: { gte: windowStart } },
      select: { resourceId: true },
    });
    const reopened = new Set(reopenings.map((r) => r.resourceId));
    const days = decided
      .filter((d) => !reopened.has(d.id))
      .map((d) => Math.max(0, d.reviewedAt!.getTime() - d.submissionDate.getTime()) / DAY_MS);
    return { oldest: oldest._min.submissionDate?.getTime() ?? null, overdue, days: days.sort((a, b) => a - b) };
  }

  it('agree with the Prisma reads for every kind of territory', async () => {
    const located = await prisma.onefopSubmission.findMany({
      where: { region: { not: null }, department: { not: null } },
      select: { region: true, department: true, regionId: true, departmentId: true },
      distinct: ['region', 'department'],
      take: 5,
    });
    expect(located.length).toBeGreaterThan(0);

    const territories: Array<[string, Territory]> = [
      ['national', { role: 'SUPER_ADMIN' }],
      ['read-only national', { role: 'CENTRAL_AGENT' }],
      ['regional without a territory', { role: 'REGIONAL_ADMIN' }],
      ['divisional without a territory', { role: 'DIVISIONAL_ADMIN' }],
      ['unknown role', { role: 'COMPANY' }],
    ];
    located.forEach((row, i) => {
      territories.push([`regional name ${i}`, { role: 'REGIONAL_ADMIN', region: row.region!.toUpperCase() }]);
      territories.push([`divisional name ${i}`, { role: 'DIVISIONAL_ADMIN', region: row.region, department: row.department!.toLowerCase() }]);
      if (row.regionId) territories.push([`regional id ${i}`, { role: 'REGIONAL_ADMIN', regionId: row.regionId }]);
      if (row.departmentId) territories.push([`divisional id ${i}`, { role: 'DIVISIONAL_ADMIN', departmentId: row.departmentId }]);
    });

    const now = Date.now();
    const overdueBefore = new Date(now - 7 * DAY_MS);
    const windowStart = new Date(now - 90 * DAY_MS);
    const mismatches: string[] = [];

    for (const [name, territory] of territories) {
      const scope = territoryWhere(territory);
      for (const [view, includeArchived] of [['queue', false], ['completed', false], ['completed', true]] as const) {
        const expected = await viaPrisma(territory, view, includeArchived);
        const rows = await loadQueueCounts(prisma as any, scope, view, includeArchived);
        const label = `${name} ${view} archived=${includeArchived}`;
        if (rows.map((r) => `${r.status}|${r.region}|${r.files}`).sort().join() !== expected.groups.join()) mismatches.push(`${label}: groups`);
        if (rows.reduce((n, r) => n + r.blockingAnomalies, 0) !== expected.blocking) mismatches.push(`${label}: blocking`);
        if (rows.reduce((n, r) => n + r.statisticallyReady, 0) !== expected.ready) mismatches.push(`${label}: ready`);
      }
      const expected = await paceViaPrisma(territory, overdueBefore, windowStart);
      const pace = await loadReviewPace(prisma as any, scope, overdueBefore, windowStart);
      const oldest = pace.oldestPending === null ? null : new Date(pace.oldestPending).getTime();
      if (oldest !== expected.oldest) mismatches.push(`${name}: oldest`);
      if (pace.overdue !== expected.overdue) mismatches.push(`${name}: overdue`);
      const days = [...(pace.decidedDays ?? [])].sort((a, b) => a - b);
      if (days.length !== expected.days.length || days.some((d, i) => Math.abs(d - expected.days[i]) > 1e-6)) mismatches.push(`${name}: decided`);
    }
    expect(mismatches).toEqual([]);
  }, 300_000);
});
