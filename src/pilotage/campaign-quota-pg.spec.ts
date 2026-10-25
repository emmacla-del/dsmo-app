/**
 * Postgres-level regression test for the region x type registration quotas.
 *
 * WHY THIS FILE EXISTS. The 13 unit tests around replaceScoped reach
 * CampaignQuota through the mocked ScopedTable interface, which carries no
 * constraints, so they passed while the write was impossible: every per-type
 * row of a region collided on campaign_quotas_territorial_region_uidx, the
 * second insert raised 23505, and the transaction helper reported it as
 * ConflictException(« Un objectif existe déjà pour ce territoire. »). A mocked
 * table cannot catch a database constraint. This file is the cover for that
 * blind spot: it runs the real write against real Postgres.
 *
 * SAFETY. Every test runs inside an interactive transaction that is always
 * rolled back, including when an assertion fails, so no row, and no audit
 * entry, survives a run. afterAll re-counts the table to prove it.
 *
 * OPT-IN. Skipped unless PG_INTEGRATION=1, because the default `npm test`
 * must not reach for a database. Run it with `npm run test:pg`.
 *
 * It calls writeQuotas rather than putCampaignQuotas because the public
 * method opens its own transaction, which this file could not roll back.
 * writeQuotas is the whole write, replaceScoped included; the validation
 * putCampaignQuotas does first is exercised here through parseTargetBody and,
 * for territory existence, by its own unit tests.
 */
import { BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PilotageService } from './pilotage.service';
import { parseTargetBody, ParsedTargetBody } from './pilotage-validation';
import type { PrismaService } from '../prisma/prisma.service';

const ENABLED = process.env.PG_INTEGRATION === '1';
const SENTINEL = 'ROLLBACK_SENTINEL';
const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');

type WriteQuotas = (
  tx: Prisma.TransactionClient,
  actorId: string,
  campaignId: string,
  parsed: ParsedTargetBody,
) => Promise<void>;

const body = (entries: Record<string, unknown>[]) => ({ entries });
const quota = (regionId: string, entityType: string | null, submissionTarget: number) => ({
  regionId,
  entityType,
  submissionTarget,
});

(ENABLED ? describe : describe.skip)('campaign quotas against Postgres', () => {
  let prisma: PrismaClient;
  let writeQuotas: WriteQuotas;
  let campaignId: string;
  let regionId: string;
  let departmentId: string | null;
  let actorId: string;
  let rowsAtStart: number;
  let bootstrapped: string[] = [];

  /**
   * The schema the write needs. When the two 2026-10-25 migrations have
   * deployed this only asserts they are there; when they have not, it applies
   * them inside the test's own transaction so the test still means something
   * before the deploy, and says which it had to apply.
   */
  async function ensureSchemaUnderTest(tx: Prisma.TransactionClient): Promise<void> {
    const applied: string[] = [];
    const column = await tx.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_quotas' AND column_name = 'entityType'`,
    );
    if (column.length === 0) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "campaign_quotas" ADD COLUMN IF NOT EXISTS "entityType" "OnefopEntityType"`,
      );
      applied.push('20261025140000_campaign_quota_entity_type');
    }
    const typeIndex = await tx.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM pg_indexes
        WHERE tablename = 'campaign_quotas'
          AND indexname = 'campaign_quotas_territorial_region_type_uidx'`,
    );
    if (typeIndex.length === 0) {
      const name = '20261025150000_campaign_quota_entity_type_unique';
      const sql = readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf-8');
      for (const statement of sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && !s.split('\n').every((line) => line.trim().startsWith('--')))) {
        await tx.$executeRawUnsafe(statement);
      }
      applied.push(name);
    }
    if (applied.length > 0) bootstrapped = applied;
  }

  /** Runs `work` in a transaction that is always rolled back. */
  async function inRollback<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    let value!: T;
    let failure: unknown;
    try {
      await prisma.$transaction(
        async (tx) => {
          await ensureSchemaUnderTest(tx);
          try {
            value = await work(tx);
          } catch (error) {
            // Kept so the rollback below still happens, then rethrown.
            failure = error;
          }
          throw new Error(SENTINEL);
        },
        { timeout: 90_000 },
      );
    } catch (error) {
      if (!String((error as Error).message).includes(SENTINEL)) throw error;
    }
    if (failure !== undefined) throw failure;
    return value;
  }

  /** The region-level rows the editor would read back, type then target. */
  async function regionRows(tx: Prisma.TransactionClient) {
    const rows = await tx.campaignQuota.findMany({
      where: { campaignId, regionId, scopeKind: 'TERRITORIAL', departmentId: null },
      select: { entityType: true, submissionTarget: true },
    });
    return rows
      .map((row) => ({ entityType: row.entityType as string | null, target: row.submissionTarget }))
      .sort((a, b) => String(a.entityType).localeCompare(String(b.entityType)));
  }

  const save = (tx: Prisma.TransactionClient, entries: Record<string, unknown>[]) =>
    writeQuotas(tx, actorId, campaignId, parseTargetBody(body(entries), 'submissionTarget'));

  beforeAll(async () => {
    prisma = new PrismaClient();
    const service = new PilotageService(prisma as unknown as PrismaService);
    writeQuotas = (service as unknown as { writeQuotas: WriteQuotas }).writeQuotas.bind(
      service,
    ) as WriteQuotas;

    const campaign = await prisma.dataCampaign.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    const actor =
      (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })) ??
      (await prisma.user.findFirst({ select: { id: true } }));
    if (!campaign || !actor) {
      throw new Error('this database has no campaign or no user to write a quota with');
    }
    campaignId = campaign.id;
    actorId = actor.id;

    // A region holding no region-level row for this campaign, so the counts
    // asserted below are the test's own rows and nothing else.
    const taken = await prisma.$queryRawUnsafe<{ regionId: string }[]>(
      `SELECT DISTINCT "regionId" FROM campaign_quotas
        WHERE "campaignId" = $1 AND "departmentId" IS NULL AND "scopeKind" = 'TERRITORIAL'`,
      campaignId,
    );
    const busy = new Set(taken.map((row) => row.regionId));
    const region = (await prisma.region.findMany({ select: { id: true }, orderBy: { name: 'asc' } })).find(
      (candidate) => !busy.has(candidate.id),
    );
    if (!region) throw new Error('every region already carries a region-level quota for this campaign');
    regionId = region.id;
    departmentId =
      (await prisma.department.findFirst({ where: { regionId }, select: { id: true } }))?.id ?? null;

    rowsAtStart = await prisma.campaignQuota.count();
  }, 120_000);

  afterAll(async () => {
    if (prisma) {
      const rowsAtEnd = await prisma.campaignQuota.count();
      await prisma.$disconnect();
      // Guards the rollback itself: a leak here means a test wrote to the
      // shared database, which no run of this file may do.
      expect(rowsAtEnd).toBe(rowsAtStart);
    }
    if (bootstrapped.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `campaign-quota-pg: schema applied inside the test transaction because it is not deployed yet: ${bootstrapped.join(', ')}`,
      );
    }
  }, 120_000);

  it('stores one row per entity type for a region', async () => {
    const rows = await inRollback(async (tx) => {
      await save(tx, [
        quota(regionId, 'ENTREPRISE', 11),
        quota(regionId, 'COOPERATIVE', 22),
        quota(regionId, 'CTD', 33),
      ]);
      return regionRows(tx);
    });

    expect(rows).toEqual([
      { entityType: 'COOPERATIVE', target: 22 },
      { entityType: 'CTD', target: 33 },
      { entityType: 'ENTREPRISE', target: 11 },
    ]);
  }, 120_000);

  it('a later save updates one type, leaves one alone and deletes the third', async () => {
    const rows = await inRollback(async (tx) => {
      await save(tx, [
        quota(regionId, 'ENTREPRISE', 11),
        quota(regionId, 'COOPERATIVE', 22),
        quota(regionId, 'CTD', 33),
      ]);
      await save(tx, [quota(regionId, 'ENTREPRISE', 11), quota(regionId, 'COOPERATIVE', 99)]);
      return regionRows(tx);
    });

    expect(rows).toEqual([
      { entityType: 'COOPERATIVE', target: 99 },
      { entityType: 'ENTREPRISE', target: 11 },
    ]);
  }, 120_000);

  it('moves a quota from one type to another without dropping it', async () => {
    // Same regional total, different split: the shape that read as "no
    // change" in the editor, and that replaceScoped must key on type to match.
    const rows = await inRollback(async (tx) => {
      await save(tx, [quota(regionId, 'ENTREPRISE', 50)]);
      await save(tx, [quota(regionId, 'COOPERATIVE', 50)]);
      return regionRows(tx);
    });

    expect(rows).toEqual([{ entityType: 'COOPERATIVE', target: 50 }]);
  }, 120_000);

  it('switching the region to an all-types quota clears its per-type rows', async () => {
    const rows = await inRollback(async (tx) => {
      await save(tx, [quota(regionId, 'ENTREPRISE', 11), quota(regionId, 'CTD', 33)]);
      await save(tx, [quota(regionId, null, 44)]);
      return regionRows(tx);
    });

    expect(rows).toEqual([{ entityType: null, target: 44 }]);
  }, 120_000);

  it('the database itself refuses a second row for one type', async () => {
    // Not the validator: the index. parseTargetBody already rejects a repeated
    // entry, so this inserts behind its back to prove the constraint is real.
    const outcome = await inRollback(async (tx) => {
      await save(tx, [quota(regionId, 'ENTREPRISE', 11)]);
      await tx.$executeRawUnsafe(`SAVEPOINT duplicate_type`);
      try {
        await tx.$executeRawUnsafe(
          `INSERT INTO campaign_quotas
             (id, "campaignId", "scopeKind", "regionId", "departmentId", "entityType",
              "submissionTarget", "createdBy", "updatedBy", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, 'TERRITORIAL', $2, NULL, 'ENTREPRISE', 12, $3, $3, NOW(), NOW())`,
          campaignId,
          regionId,
          actorId,
        );
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT duplicate_type`);
        return 'allowed';
      } catch (error) {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT duplicate_type`);
        return String((error as Error).message).includes('23505') ? 'refused' : 'other';
      }
    });

    expect(outcome).toBe('refused');
  }, 120_000);

  it('switching a region from department quotas to per-type quotas clears the department rows', async () => {
    if (!departmentId) return;
    // A named region is replaced whole, across grains: `existing` is every
    // territorial row of that region, so the department row is not in
    // `wanted` and goes. That is the mode switch, and it is why a region may
    // hold only one mode at a time (assertNoMixedMode).
    const after = await inRollback(async (tx) => {
      await save(tx, [{ regionId, departmentId, submissionTarget: 7 }]);
      await save(tx, [quota(regionId, 'ENTREPRISE', 11)]);
      return {
        department: await tx.campaignQuota.count({ where: { campaignId, regionId, departmentId } }),
        region: await regionRows(tx),
      };
    });

    expect(after).toEqual({ department: 0, region: [{ entityType: 'ENTREPRISE', target: 11 }] });
  }, 120_000);

  it('leaves another region alone when one region is saved', async () => {
    const other = (
      await prisma.region.findMany({ select: { id: true }, orderBy: { name: 'asc' } })
    ).find((candidate) => candidate.id !== regionId);
    if (!other) return;

    const kept = await inRollback(async (tx) => {
      await save(tx, [quota(other.id, 'ENTREPRISE', 5)]);
      await save(tx, [quota(regionId, 'CTD', 33)]);
      return tx.campaignQuota.findMany({
        where: { campaignId, regionId: other.id, departmentId: null, scopeKind: 'TERRITORIAL' },
        select: { entityType: true, submissionTarget: true },
      });
    });

    expect(kept).toEqual([{ entityType: 'ENTREPRISE', submissionTarget: 5 }]);
  }, 120_000);

  it('refuses a repeated type, and a department row naming a type, before the database', async () => {
    expect(() =>
      parseTargetBody(body([quota(regionId, 'ENTREPRISE', 11), quota(regionId, 'ENTREPRISE', 12)]), 'submissionTarget'),
    ).toThrow(BadRequestException);

    expect(() =>
      parseTargetBody(
        body([{ regionId, departmentId: departmentId ?? 'x', entityType: 'ENTREPRISE', submissionTarget: 11 }]),
        'submissionTarget',
      ),
    ).toThrow(BadRequestException);
  });
});
