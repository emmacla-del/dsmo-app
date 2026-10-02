import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OnefopEntityType, OnefopStatus, Prisma, SubmissionModule } from '@prisma/client';
import { Territory } from '../auth/territory';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAndValidateTerritory } from '../territory/territory-resolver';
import { resolveTargetScope, TargetScope } from './pilotage-scope';
import {
  CampaignReturnsResponse,
  CampaignReturnsSummary,
  DepartmentReturnRow,
  RegionReturnRow,
  ReturnMetrics,
  addMetrics,
  buildMetrics,
  emptyMetrics,
  isApprovedStatus,
  isReceivedStatus,
} from './pilotage-returns';
import {
  addCounts,
  applyRow,
  bucketKey,
  classifyBucket,
  CompanyStockRow,
  coverageRate,
  emptyCounts,
  isRegistered,
  StockCounts,
} from './pilotage-coverage';
import {
  assertEntryCount,
  assertNoMixedClear,
  assertNoMixedMode,
  ParsedTargetBody,
  parseTargetBody,
  parseYear,
  summarizeRegion,
  TargetEntry,
  TargetField,
  TargetMode,
} from './pilotage-validation';

export const PilotageAuditAction = {
  INSCRIPTION_TARGET_UPSERT: 'INSCRIPTION_TARGET_UPSERT',
  INSCRIPTION_TARGET_DELETE: 'INSCRIPTION_TARGET_DELETE',
  CAMPAIGN_QUOTA_UPSERT: 'CAMPAIGN_QUOTA_UPSERT',
  CAMPAIGN_QUOTA_DELETE: 'CAMPAIGN_QUOTA_DELETE',
  CENTRAL_INSCRIPTION_TARGET_UPSERT: 'CENTRAL_INSCRIPTION_TARGET_UPSERT',
  CENTRAL_INSCRIPTION_TARGET_DELETE: 'CENTRAL_INSCRIPTION_TARGET_DELETE',
  CENTRAL_CAMPAIGN_QUOTA_UPSERT: 'CENTRAL_CAMPAIGN_QUOTA_UPSERT',
  CENTRAL_CAMPAIGN_QUOTA_DELETE: 'CENTRAL_CAMPAIGN_QUOTA_DELETE',
} as const;

type ScopeKey = { year: number } | { campaignId: string };
type ScopedDelegate = 'territoryTarget' | 'campaignQuota';
type CentralDelegate = 'centralInscriptionTarget' | 'centralCampaignQuota';

interface StoredRow {
  id: string;
  regionId: string;
  departmentId: string | null;
  inscriptionTarget?: number;
  submissionTarget?: number;
}

/** The two scoped tables share this shape. Prisma's generated delegates do not share a call signature. */
interface ScopedTable {
  findMany(args: { where: Record<string, unknown> }): Promise<StoredRow[]>;
  create(args: { data: Record<string, unknown> }): Promise<StoredRow>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<StoredRow>;
  delete(args: { where: { id: string } }): Promise<unknown>;
}

interface CentralRow {
  id: string;
  inscriptionTarget?: number;
  submissionTarget?: number;
}

interface CentralTable {
  findUnique(args: { where: ScopeKey }): Promise<CentralRow | null>;
  create(args: { data: Record<string, unknown> }): Promise<CentralRow>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
}

interface ShapedRegion {
  regionId: string;
  name: string;
  mode: TargetMode;
  target: number | null;
  departments: Array<{ departmentId: string; name: string; target: number | null }>;
}

@Injectable()
export class PilotageService {
  constructor(private readonly prisma: PrismaService) {}

  async getInscriptionTargets(territory: Territory | null | undefined, yearRaw: unknown) {
    const year = parseYear(yearRaw);
    const { scope, regions } = await this.loadGrid(territory, (current) =>
      this.prisma.territoryTarget
        .findMany({ where: { year, ...regionFilter(current) } })
        .then((rows) => rows.map((row) => ({ regionId: row.regionId, departmentId: row.departmentId, target: row.inscriptionTarget }))),
    );
    const central = scope.kind === 'national'
      ? await this.prisma.centralInscriptionTarget.findUnique({ where: { year } })
      : null;
    return {
      year,
      central: central ? { inscriptionTarget: central.inscriptionTarget } : null,
      regions: labelTargets(regions, 'inscriptionTarget'),
    };
  }

  async getCoverage(territory: Territory | null | undefined, yearRaw: unknown) {
    const year = parseYear(yearRaw);
    const { scope, regions } = await this.loadGrid(territory, (current) =>
      this.prisma.territoryTarget
        .findMany({ where: { year, ...regionFilter(current) } })
        .then((rows) => rows.map((row) => ({ regionId: row.regionId, departmentId: row.departmentId, target: row.inscriptionTarget }))),
    );
    if (scope.kind === 'none') {
      return { year, central: null, unassigned: null, nullEntityType: null, regions: [] };
    }

    const national = scope.kind === 'national';
    const hideRegionStock = scope.kind === 'department';
    const [centralTarget, companies] = await Promise.all([
      national ? this.prisma.centralInscriptionTarget.findUnique({ where: { year } }) : Promise.resolve(null),
      this.prisma.company.findMany({
        where: companyWhere(scope),
        select: {
          entityType: true,
          regionId: true,
          departmentId: true,
          establishmentId: true,
          establishmentIdGeneratedAt: true,
          createdAt: true,
          departmentRef: { select: { regionId: true } },
          user: { select: { status: true, isActive: true } },
        },
      }),
    ]);

    const tallies = new Map<string, StockCounts>();
    for (const company of companies) {
      const row = toStockRow(company);
      const key = bucketKey(classifyBucket(row));
      const counts = tallies.get(key) ?? emptyCounts();
      applyRow(counts, row, year);
      tallies.set(key, counts);
    }

    return {
      year,
      central: national
        ? withTarget(tallies.get('central') ?? emptyCounts(), centralTarget?.inscriptionTarget ?? null)
        : null,
      unassigned: national ? tallies.get('unassigned') ?? emptyCounts() : null,
      nullEntityType: national ? tallies.get('nullEntityType') ?? emptyCounts() : null,
      regions: regions.map((region) => {
        const departments = region.departments.map((department) => {
          const counts = tallies.get(bucketKey({
            kind: 'department',
            regionId: region.regionId,
            departmentId: department.departmentId,
          })) ?? emptyCounts();
          return {
            departmentId: department.departmentId,
            name: department.name,
            ...counts,
            inscriptionTarget: department.target,
            rate: coverageRate(counts.registered, department.target),
          };
        });
        const summed = departments.reduce(
          (total, department) => addCounts(total, department),
          emptyCounts(),
        );
        return {
          regionId: region.regionId,
          name: region.name,
          mode: region.mode,
          registered: hideRegionStock ? null : summed.registered,
          registeredInYear: hideRegionStock ? null : summed.registeredInYear,
          pendingApproval: hideRegionStock ? null : summed.pendingApproval,
          pendingReview: hideRegionStock ? null : summed.pendingReview,
          complementsRequested: hideRegionStock ? null : summed.complementsRequested,
          inscriptionTarget: region.target,
          rate: hideRegionStock ? null : coverageRate(summed.registered, region.target),
          departments,
        };
      }),
    };
  }

  async putInscriptionTargets(
    actorId: string,
    territory: Territory | null | undefined,
    yearRaw: unknown,
    body: unknown,
  ) {
    requireActor(actorId);
    const year = parseYear(yearRaw);
    const parsed = parseTargetBody(body, 'inscriptionTarget');
    await this.prepare(parsed);
    await this.transaction((tx) => this.writeInscriptions(tx, actorId, year, parsed));
    return this.getInscriptionTargets(territory, year);
  }

  async getCampaignQuotas(territory: Territory | null | undefined, campaignId: string) {
    const campaign = await this.requireOnefopCampaign(campaignId);
    const { scope, regions } = await this.loadGrid(territory, (current) =>
      this.prisma.campaignQuota
        .findMany({ where: { campaignId, ...regionFilter(current) } })
        .then((rows) => rows.map((row) => ({ regionId: row.regionId, departmentId: row.departmentId, target: row.submissionTarget }))),
    );
    const central = scope.kind === 'national'
      ? await this.prisma.centralCampaignQuota.findUnique({ where: { campaignId } })
      : null;
    return {
      campaign: campaignSummary(campaign),
      central: central ? { submissionTarget: central.submissionTarget } : null,
      regions: labelTargets(regions, 'submissionTarget'),
    };
  }

  async getCampaignReturns(
    territory: Territory | null | undefined,
    campaignId: string,
  ): Promise<CampaignReturnsResponse> {
    const campaign = await this.requireOnefopCampaign(campaignId);
    const { scope, regions } = await this.loadGrid(territory, (current) =>
      this.prisma.campaignQuota
        .findMany({ where: { campaignId, ...regionFilter(current) } })
        .then((rows) =>
          rows.map((row) => ({
            regionId: row.regionId,
            departmentId: row.departmentId,
            target: row.submissionTarget,
          })),
        ),
    );

    const summary: CampaignReturnsSummary = {
      id: campaign.id,
      name: campaign.name,
      code: campaign.code,
      collectionType: campaign.collectionType,
      status: campaign.status,
      startDate: campaign.startDate ? campaign.startDate.toISOString() : null,
      endDate: campaign.endDate ? campaign.endDate.toISOString() : null,
      referenceYear: campaign.referenceYear,
      referenceQuarter: campaign.referenceQuarter,
    };

    if (scope.kind === 'none') {
      return {
        campaign: summary,
        central: null,
        unassigned: null,
        regions: [],
        totals: emptyMetrics(),
      };
    }

    const national = scope.kind === 'national';
    const [centralQuota, companies, submissions] = await Promise.all([
      national
        ? this.prisma.centralCampaignQuota.findUnique({ where: { campaignId } })
        : Promise.resolve(null),
      this.prisma.company.findMany({
        where: companyWhere(scope),
        select: {
          entityType: true,
          regionId: true,
          departmentId: true,
          establishmentId: true,
          establishmentIdGeneratedAt: true,
          createdAt: true,
          departmentRef: { select: { regionId: true } },
          user: { select: { status: true, isActive: true } },
        },
      }),
      this.prisma.onefopSubmission.findMany({
        where: {
          campaignId,
          ...submissionWhere(scope),
        },
        select: {
          id: true,
          companyId: true,
          establishmentId: true,
          formType: true,
          status: true,
          isLate: true,
          regionId: true,
          departmentId: true,
          submissionDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Active registered stock by bucket (requires isRegistered)
    const registeredStockByBucket = new Map<string, number>();
    for (const company of companies) {
      const row = toStockRow(company);
      if (isRegistered(row)) {
        const key = bucketKey(classifyBucket(row));
        registeredStockByBucket.set(key, (registeredStockByBucket.get(key) ?? 0) + 1);
      }
    }

    // Deduplicate by establishment, not by company: the unit of return is the
    // establishment (t3-returns-vs-quotas.md §3.2 and footnote 1), now that
    // Phase E.1 is live and OnefopSubmission.establishmentId is a non-nullable
    // FK to Establishment. Resubmissions after a rejection still count once.
    //
    // While Phase E.1's invariant holds — one principal establishment per
    // company, secondary sites paused — this is numerically identical to the
    // previous company-level dedup. It stops being identical the moment
    // secondary sites ship, at which point note that `registeredStock` (the
    // responseRate denominator) still counts companies: realigning that
    // denominator is a statistical-definition change and belongs with
    // unpausing Phase E, not here.
    const byEstablishment = new Map<string, typeof submissions>();
    for (const sub of submissions) {
      const key = sub.establishmentId ?? `sub-${sub.id}`;
      const list = byEstablishment.get(key) ?? [];
      list.push(sub);
      byEstablishment.set(key, list);
    }

    interface BucketCounts {
      received: number;
      approved: number;
      onTime: number;
      late: number;
    }
    const countsByBucket = new Map<string, BucketCounts>();

    function increment(bucket: string, approved: boolean, late: boolean) {
      const current = countsByBucket.get(bucket) ?? { received: 0, approved: 0, onTime: 0, late: 0 };
      current.received += 1;
      if (approved) current.approved += 1;
      if (late) current.late += 1;
      else current.onTime += 1;
      countsByBucket.set(bucket, current);
    }

    for (const [, establishmentSubs] of byEstablishment) {
      // Exclude DRAFT submissions
      const nonDrafts = establishmentSubs.filter((s) => s.status !== OnefopStatus.DRAFT);
      if (nonDrafts.length === 0) continue;

      // Find the latest received submission (PENDING_REVIEW, APPROVED, CORRECTION_REQUESTED)
      const receivedSub = nonDrafts.find((s) => isReceivedStatus(s.status));
      if (!receivedSub) {
        // All non-drafts are REJECTED -> not counted in received
        continue;
      }

      const approved = isApprovedStatus(receivedSub.status);
      const late = receivedSub.isLate;

      // Bucketing
      if (receivedSub.formType === OnefopEntityType.ADMINISTRATION) {
        increment('central', approved, late);
      } else if (!receivedSub.regionId || !receivedSub.departmentId) {
        increment('unassigned', approved, late);
      } else {
        increment(
          bucketKey({
            kind: 'department',
            regionId: receivedSub.regionId,
            departmentId: receivedSub.departmentId,
          }),
          approved,
          late,
        );
      }
    }

    // Build department and region rows
    const regionRows: RegionReturnRow[] = regions.map((region) => {
      const departments: DepartmentReturnRow[] = region.departments.map((department) => {
        const key = bucketKey({
          kind: 'department',
          regionId: region.regionId,
          departmentId: department.departmentId,
        });
        const counts = countsByBucket.get(key) ?? { received: 0, approved: 0, onTime: 0, late: 0 };
        const registeredStock = registeredStockByBucket.get(key) ?? 0;
        const metrics = buildMetrics(department.target, counts, registeredStock);
        return {
          departmentId: department.departmentId,
          name: department.name,
          ...metrics,
        };
      });

      // Sum actuals across departments
      const summedCounts = departments.reduce(
        (acc, d) => ({
          received: acc.received + d.received,
          approved: acc.approved + d.approved,
          onTime: acc.onTime + d.onTime,
          late: acc.late + d.late,
        }),
        { received: 0, approved: 0, onTime: 0, late: 0 },
      );
      const summedStock = departments.reduce((acc, d) => acc + d.registeredStock, 0);

      // Region quota is region.target (sum of depts or explicit region target)
      const regionMetrics = buildMetrics(region.target, summedCounts, summedStock);
      return {
        regionId: region.regionId,
        name: region.name,
        mode: region.mode,
        ...regionMetrics,
        departments,
      };
    });

    // Central bucket (National only)
    let central: ReturnMetrics | null = null;
    if (national) {
      const centralCounts = countsByBucket.get('central') ?? { received: 0, approved: 0, onTime: 0, late: 0 };
      const centralStock = registeredStockByBucket.get('central') ?? 0;
      central = buildMetrics(centralQuota?.submissionTarget ?? null, centralCounts, centralStock);
    }

    // Unassigned bucket (National only)
    let unassigned: ReturnMetrics | null = null;
    if (national) {
      const unassignedCounts = countsByBucket.get('unassigned') ?? { received: 0, approved: 0, onTime: 0, late: 0 };
      const unassignedStock = registeredStockByBucket.get('unassigned') ?? 0;
      unassigned = buildMetrics(null, unassignedCounts, unassignedStock);
    }

    // Totals rollup scoped to jurisdiction
    let totals: ReturnMetrics;
    if (national) {
      const allMetrics = [...regionRows];
      if (central) allMetrics.push(central as any);
      if (unassigned && unassigned.received > 0) allMetrics.push(unassigned as any);

      totals = allMetrics.reduce(
        (acc, m) => addMetrics(acc, m),
        emptyMetrics(),
      );
    } else if (scope.kind === 'region') {
      totals = regionRows.length > 0 ? regionRows[0] : emptyMetrics();
    } else {
      totals =
        regionRows.length > 0 && regionRows[0].departments.length > 0
          ? regionRows[0].departments[0]
          : emptyMetrics();
    }

    return {
      campaign: summary,
      central,
      unassigned,
      regions: regionRows,
      totals,
    };
  }

  async putCampaignQuotas(
    actorId: string,
    territory: Territory | null | undefined,
    campaignId: string,
    body: unknown,
  ) {
    requireActor(actorId);
    const campaign = await this.requireOnefopCampaign(campaignId);
    const parsed = parseTargetBody(body, 'submissionTarget');
    await this.prepare(parsed);
    await this.transaction((tx) => this.writeQuotas(tx, actorId, campaign.id, parsed));
    return this.getCampaignQuotas(territory, campaign.id);
  }

  private async prepare(parsed: ParsedTargetBody): Promise<void> {
    const [regionCount, departmentCount] = await Promise.all([
      this.prisma.region.count(),
      this.prisma.department.count(),
    ]);
    assertEntryCount(parsed.entries.length + parsed.clearedRegionIds.length, regionCount + departmentCount);

    const allRegions = await this.prisma.region.findMany({ select: { id: true, name: true } });
    const regionNames = new Map(allRegions.map((r) => [r.id, r.name]));

    for (const regionId of parsed.clearedRegionIds) {
      if (!regionNames.has(regionId)) {
        throw new BadRequestException(`Région introuvable (ID: '${regionId}').`);
      }
    }

    for (const entry of parsed.entries) {
      if (entry.departmentId) {
        await resolveAndValidateTerritory(this.prisma, {
          regionId: entry.regionId,
          departmentId: entry.departmentId,
        });
      } else {
        if (!regionNames.has(entry.regionId)) {
          throw new BadRequestException(`Région introuvable (ID: '${entry.regionId}').`);
        }
      }
    }

    assertNoMixedMode(parsed.entries, regionNames);
    assertNoMixedClear(parsed.entries, parsed.clearedRegionIds, regionNames);
  }

  private async writeInscriptions(
    tx: Prisma.TransactionClient,
    actorId: string,
    year: number,
    parsed: ParsedTargetBody,
  ): Promise<void> {
    await this.replaceScoped(
      tx, actorId, { year }, parsed.entries, parsed.clearedRegionIds, 'territoryTarget', 'inscriptionTarget', 'TerritoryTarget',
      PilotageAuditAction.INSCRIPTION_TARGET_UPSERT, PilotageAuditAction.INSCRIPTION_TARGET_DELETE,
    );
    await this.applyCentral(
      tx, actorId, { year }, 'centralInscriptionTarget', 'inscriptionTarget', parsed.central, 'CentralInscriptionTarget',
      PilotageAuditAction.CENTRAL_INSCRIPTION_TARGET_UPSERT, PilotageAuditAction.CENTRAL_INSCRIPTION_TARGET_DELETE,
    );
  }

  private async writeQuotas(
    tx: Prisma.TransactionClient,
    actorId: string,
    campaignId: string,
    parsed: ParsedTargetBody,
  ): Promise<void> {
    await this.replaceScoped(
      tx, actorId, { campaignId }, parsed.entries, parsed.clearedRegionIds, 'campaignQuota', 'submissionTarget', 'CampaignQuota',
      PilotageAuditAction.CAMPAIGN_QUOTA_UPSERT, PilotageAuditAction.CAMPAIGN_QUOTA_DELETE,
    );
    await this.applyCentral(
      tx, actorId, { campaignId }, 'centralCampaignQuota', 'submissionTarget', parsed.central, 'CentralCampaignQuota',
      PilotageAuditAction.CENTRAL_CAMPAIGN_QUOTA_UPSERT, PilotageAuditAction.CENTRAL_CAMPAIGN_QUOTA_DELETE,
    );
  }

  /** Regions named in entries or clearedRegionIds are replaced. Every other region is left as stored. */
  private async replaceScoped(
    tx: Prisma.TransactionClient,
    actorId: string,
    scope: ScopeKey,
    entries: TargetEntry[],
    clearedRegionIds: string[],
    delegate: ScopedDelegate,
    field: TargetField,
    resourceType: string,
    upsertAction: string,
    deleteAction: string,
  ): Promise<void> {
    const byRegion = new Map<string, TargetEntry[]>();
    for (const regionId of clearedRegionIds) {
      byRegion.set(regionId, []);
    }
    for (const entry of entries) {
      const list = byRegion.get(entry.regionId) ?? [];
      list.push(entry);
      byRegion.set(entry.regionId, list);
    }

    const table = tx[delegate] as unknown as ScopedTable;
    for (const [regionId, desired] of byRegion) {
      const existing = await table.findMany({ where: { ...scope, regionId } });
      const wanted = new Set(desired.map((entry) => entry.departmentId));
      for (const row of existing) {
        if (wanted.has(row.departmentId)) continue;
        const previous = numberOrNull(row[field]);
        await table.delete({ where: { id: row.id } });
        await writeAudit(tx, actorId, deleteAction, resourceType, row.id, previous, null, {
          ...scope,
          regionId,
          departmentId: row.departmentId,
        });
      }
      for (const entry of desired) {
        const current = existing.find((row) => row.departmentId === entry.departmentId);
        if (current && current[field] === entry.target) continue;
        const details = { ...scope, regionId, departmentId: entry.departmentId };
        if (current) {
          const previous = numberOrNull(current[field]);
          await table.update({
            where: { id: current.id },
            data: { [field]: entry.target, updatedBy: actorId },
          });
          await writeAudit(tx, actorId, upsertAction, resourceType, current.id, previous, entry.target, details);
        } else {
          const created = await table.create({
            data: {
              ...scope,
              regionId,
              departmentId: entry.departmentId,
              [field]: entry.target,
              createdBy: actorId,
              updatedBy: actorId,
            },
          });
          await writeAudit(tx, actorId, upsertAction, resourceType, created.id, null, entry.target, details);
        }
      }
    }
  }

  private async applyCentral(
    tx: Prisma.TransactionClient,
    actorId: string,
    where: ScopeKey,
    delegate: CentralDelegate,
    field: TargetField,
    value: number | null | undefined,
    resourceType: string,
    upsertAction: string,
    deleteAction: string,
  ): Promise<void> {
    if (value === undefined) return;
    const table = tx[delegate] as unknown as CentralTable;
    const existing = await table.findUnique({ where });
    if (value === null) {
      if (!existing) return;
      const previous = numberOrNull(existing[field]);
      await table.delete({ where: { id: existing.id } });
      await writeAudit(tx, actorId, deleteAction, resourceType, existing.id, previous, null, where);
      return;
    }
    if (existing && existing[field] === value) return;
    if (existing) {
      const previous = numberOrNull(existing[field]);
      await table.update({
        where: { id: existing.id },
        data: { [field]: value, updatedBy: actorId },
      });
      await writeAudit(tx, actorId, upsertAction, resourceType, existing.id, previous, value, where);
      return;
    }
    const created = await table.create({
      data: { ...where, [field]: value, createdBy: actorId, updatedBy: actorId },
    });
    await writeAudit(tx, actorId, upsertAction, resourceType, created.id, null, value, where);
  }

  private async loadGrid(
    territory: Territory | null | undefined,
    loadRows: (scope: TargetScope) => Promise<Array<{ regionId: string; departmentId: string | null; target: number }>>,
  ): Promise<{ scope: TargetScope; regions: ShapedRegion[] }> {
    const scope = await resolveTargetScope(this.prisma, territory);
    if (scope.kind === 'none') return { scope, regions: [] };

    const regions = await this.prisma.region.findMany({
      where: scope.kind === 'national' ? undefined : { id: scope.regionId },
      orderBy: { name: 'asc' },
      include: {
        departments: {
          where: scope.kind === 'department' ? { id: scope.departmentId } : undefined,
          orderBy: { name: 'asc' },
        },
      },
    });
    const rows = await loadRows(scope);
    return {
      scope,
      regions: regions.map((region) => {
        const own = rows.filter((row) => row.regionId === region.id);
        const summary = summarizeRegion(own.map((row) => ({ departmentId: row.departmentId, target: row.target })));
        const target = scope.kind === 'department' && summary.mode !== 'REGION' ? null : summary.target;
        return {
          regionId: region.id,
          name: region.name,
          mode: summary.mode,
          target,
          departments: region.departments.map((department) => ({
            departmentId: department.id,
            name: department.name,
            target: own.find((row) => row.departmentId === department.id)?.target ?? null,
          })),
        };
      }),
    };
  }

  private async requireOnefopCampaign(id: string) {
    const campaign = await this.prisma.dataCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        collectionType: true,
        status: true,
        startDate: true,
        endDate: true,
        referenceYear: true,
        referenceQuarter: true,
      },
    });
    if (!campaign) throw new NotFoundException('Campagne introuvable.');
    if (campaign.collectionType !== SubmissionModule.ONEFOP) {
      throw new BadRequestException('Les objectifs de campagne concernent uniquement les campagnes ONEFOP.');
    }
    return campaign;
  }

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const attempts = 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < attempts
        ) {
          continue;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Un objectif existe déjà pour ce territoire.');
        }
        throw error;
      }
    }
    throw new ConflictException('Un objectif existe déjà pour ce territoire.');
  }
}

function requireActor(actorId: string): void {
  if (typeof actorId !== 'string' || actorId.trim() === '') throw new UnauthorizedException();
}

function regionFilter(scope: TargetScope): { regionId?: string } {
  if (scope.kind === 'region' || scope.kind === 'department') return { regionId: scope.regionId };
  return {};
}

function companyWhere(scope: TargetScope): Record<string, unknown> {
  if (scope.kind === 'region') return { regionId: scope.regionId };
  if (scope.kind === 'department') return { departmentId: scope.departmentId };
  return {};
}

function submissionWhere(scope: TargetScope): Record<string, unknown> {
  if (scope.kind === 'region') return { regionId: scope.regionId };
  if (scope.kind === 'department') return { departmentId: scope.departmentId };
  return {};
}

function toStockRow(company: {
  entityType: string | null;
  regionId: string | null;
  departmentId: string | null;
  establishmentId: string | null;
  establishmentIdGeneratedAt: Date | null;
  createdAt: Date;
  departmentRef: { regionId: string } | null;
  user: { status: string; isActive: boolean };
}): CompanyStockRow {
  return {
    entityType: company.entityType,
    regionId: company.regionId,
    departmentId: company.departmentId,
    departmentRegionId: company.departmentRef?.regionId ?? null,
    establishmentId: company.establishmentId,
    establishmentIdGeneratedAt: company.establishmentIdGeneratedAt,
    createdAt: company.createdAt,
    status: company.user.status,
    isActive: company.user.isActive,
  };
}

function withTarget(counts: StockCounts, inscriptionTarget: number | null) {
  return {
    ...counts,
    inscriptionTarget,
    rate: coverageRate(counts.registered, inscriptionTarget),
  };
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function labelTargets(regions: ShapedRegion[], field: TargetField) {
  return regions.map((region) => ({
    regionId: region.regionId,
    name: region.name,
    mode: region.mode,
    [field]: region.target,
    departments: region.departments.map((department) => ({
      departmentId: department.departmentId,
      name: department.name,
      [field]: department.target,
    })),
  }));
}

function campaignSummary(campaign: {
  id: string;
  name: string;
  code: string;
  collectionType: string;
  status: string;
}) {
  return {
    id: campaign.id,
    name: campaign.name,
    code: campaign.code,
    collectionType: campaign.collectionType,
    status: campaign.status,
  };
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  previous: number | null,
  next: number | null,
  details: Record<string, unknown>,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: actorId,
      action,
      resourceType,
      resourceId,
      previousValue: previous === null ? null : String(previous),
      newValue: next === null ? null : String(next),
      details: details as Prisma.InputJsonValue,
    },
  });
}
