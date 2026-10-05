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
} as const;

type ScopeKey = { year: number } | { campaignId: string };
type ScopedDelegate = 'territoryTarget' | 'campaignQuota';
/**
 * Only CentralInscriptionTarget remains. CentralCampaignQuota left this union
 * when the ADMINISTRATION cohort target moved into CampaignQuota behind
 * scopeKind; applyCentral and this alias retire together in Phase 4, with the
 * year-scoped inscription endpoints.
 */
type CentralDelegate = 'centralInscriptionTarget';

interface StoredRow {
  id: string;
  /**
   * Non-null although CampaignQuota.regionId is nullable in the schema. The
   * cast below discards Prisma's type, so this is a claim, not a check: it
   * holds because replaceScoped only ever queries with a concrete regionId
   * (see the findMany in its region loop). That same concrete regionId is
   * what keeps the ADMINISTRATION row — regionId NULL — out of `existing`,
   * and therefore out of the delete loop that would otherwise remove it as
   * an unwanted row.
   */
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

  /**
   * ANNUAL coverage roll-up for the requested year.
   *
   * The signature is unchanged, but the target source is not. This used to
   * read TerritoryTarget: one stored row per territory per year. It now folds
   * the year's quarterly campaigns, so the annual figure is the sum of the
   * four quarters' CampaignQuota rows and no stored annual number can disagree
   * with its parts (docs/plans/campaign-model-refactor.md §4).
   */
  async getCoverage(territory: Territory | null | undefined, yearRaw: unknown) {
    const year = parseYear(yearRaw);
    return this.coverageFrom(
      territory,
      year,
      () => this.onefopCampaignIds(year, ANNUAL_QUARTERS),
      { quarter: null, semester: null },
    );
  }

  /** Semester roll-up: Q1+Q2 or Q3+Q4, folded through the same body. */
  private async getSemesterCoverage(
    territory: Territory | null | undefined,
    year: number,
    semester: number,
  ) {
    const quarters = semesterQuarters(semester);
    return this.coverageFrom(
      territory,
      year,
      () => this.onefopCampaignIds(year, quarters),
      { quarter: null, semester },
    );
  }

  /** Quarter view: one campaign, nothing to fold. */
  private async getQuarterCoverage(territory: Territory | null | undefined, campaignId: string) {
    const campaign = await this.requireOnefopCampaign(campaignId);
    if (campaign.referenceYear == null) {
      throw new BadRequestException("Cette campagne n'a pas d'année de référence.");
    }
    return this.coverageFrom(territory, campaign.referenceYear, () => Promise.resolve([campaign.id]), {
      quarter: campaign.referenceQuarter,
      semester: campaign.referenceQuarter == null ? null : semesterOf(campaign.referenceQuarter),
    });
  }

  /**
   * The ONEFOP campaigns of one year whose reference quarter is in `quarters`.
   *
   * The quarters are named explicitly rather than left out of the predicate.
   * Omitting it would also admit a campaign with referenceQuarter IS NULL,
   * which belongs to no quarter and must not leak into a roll-up. No status
   * filter and no purpose filter: this matches the ONEFOP scope that
   * requireOnefopCampaign enforces for the per-campaign reads, so a DRAFT or
   * ARCHIVED campaign's quotas count exactly as its returns do.
   */
  private async onefopCampaignIds(year: number, quarters: readonly number[]): Promise<string[]> {
    const campaigns = await this.prisma.dataCampaign.findMany({
      where: {
        collectionType: SubmissionModule.ONEFOP,
        referenceYear: year,
        referenceQuarter: { in: [...quarters] },
      },
      select: { id: true },
      orderBy: [{ referenceQuarter: 'asc' }, { code: 'asc' }],
    });
    return campaigns.map((campaign) => campaign.id);
  }

  /**
   * The one coverage body. The quarter, semester and annual views differ only
   * in which campaigns they fold, so the stock tally and the row shaping below
   * exist exactly once.
   *
   * `resolveCampaignIds` is a thunk, not a list, because loadGrid skips its
   * row loader entirely when the scope fails closed. Deferring the campaign
   * query into the callback keeps a reader with no territory from touching
   * campaign data at all, which is what the TerritoryTarget read it replaces
   * also did. The ids are captured on the way through, for the ADMINISTRATION
   * read and for `period`.
   */
  private async coverageFrom(
    territory: Territory | null | undefined,
    year: number,
    resolveCampaignIds: () => Promise<string[]>,
    bounds: { quarter: number | null; semester: number | null },
  ) {
    let campaignIds: string[] = [];
    const { scope, regions } = await this.loadGrid(territory, async (current) => {
      campaignIds = await resolveCampaignIds();
      if (campaignIds.length === 0) return [];
      const rows = await this.prisma.campaignQuota.findMany({
        where: { campaignId: { in: campaignIds }, scopeKind: 'TERRITORIAL', ...regionFilter(current) },
      });
      return foldQuotas(rows.filter(hasRegion));
    });
    const period = { year, quarter: bounds.quarter, semester: bounds.semester, campaignIds };

    if (scope.kind === 'none') {
      return { year, period, central: null, unassigned: null, nullEntityType: null, regions: [] };
    }

    const national = scope.kind === 'national';
    const hideRegionStock = scope.kind === 'department';
    const [administrationQuotas, companies] = await Promise.all([
      national && campaignIds.length > 0
        ? this.prisma.campaignQuota.findMany({
            where: { campaignId: { in: campaignIds }, scopeKind: 'ADMINISTRATION' },
            select: { submissionTarget: true },
          })
        : Promise.resolve([] as Array<{ submissionTarget: number }>),
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

    /**
     * The ministry cohort's target for the folded period: the ADMINISTRATION
     * rows of the same campaigns, summed. These answer as one national
     * respondent group and are counted in the `central` bucket, never in a
     * territorial one, so reading them here cannot double-count into the grid
     * — and the reverse exclusion, keeping them out of regions[], is the
     * scopeKind: 'TERRITORIAL' filter plus hasRegion in the loader above.
     */
    const centralTarget = sumTargets(administrationQuotas);

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
      period,
      central: national ? withTarget(tallies.get('central') ?? emptyCounts(), centralTarget) : null,
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
          companyCount: hideRegionStock ? null : summed.companyCount,
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
        .findMany({ where: { campaignId, scopeKind: 'TERRITORIAL', ...regionFilter(current) } })
        .then((rows) =>
          rows
            .filter(hasRegion)
            .map((row) => ({ regionId: row.regionId, departmentId: row.departmentId, target: row.submissionTarget })),
        ),
    );
    const central = scope.kind === 'national'
      ? await this.prisma.campaignQuota.findFirst({
          where: { campaignId, scopeKind: 'ADMINISTRATION' },
          select: { submissionTarget: true },
        })
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
        .findMany({ where: { campaignId, scopeKind: 'TERRITORIAL', ...regionFilter(current) } })
        .then((rows) =>
          rows
            .filter(hasRegion)
            .map((row) => ({
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
        ? this.prisma.campaignQuota.findFirst({
            where: { campaignId, scopeKind: 'ADMINISTRATION' },
            select: { submissionTarget: true },
          })
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

    // Deduplicate submissions by companyId (resubmissions count once)
    const byCompany = new Map<string, typeof submissions>();
    for (const sub of submissions) {
      const key = sub.companyId ?? `sub-${sub.id}`;
      const list = byCompany.get(key) ?? [];
      list.push(sub);
      byCompany.set(key, list);
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

    for (const [, companySubs] of byCompany) {
      // Exclude DRAFT submissions
      const nonDrafts = companySubs.filter((s) => s.status !== OnefopStatus.DRAFT);
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

    // Quota-relative fields (gap, quotaRate, onTimeRate) are measured only over
    // the territories that actually have a quota — see withQuotaScope. The
    // subtotals are accumulated as the rows are built, because a finished row
    // no longer says how much of its `received` was quota-backed.
    const quotaBacked = { received: 0, onTime: 0 };

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

      // Region quota is region.target (sum of depts or explicit region target).
      // An explicit region target covers the whole region, so every return in
      // it is quota-backed; a target summed from departments only covers the
      // departments that have one.
      const regionQuotaBacked =
        region.target === null
          ? { received: 0, onTime: 0 }
          : region.mode === 'REGION'
            ? { received: summedCounts.received, onTime: summedCounts.onTime }
            : departments.reduce(
                (acc, d) =>
                  d.quota === null
                    ? acc
                    : { received: acc.received + d.received, onTime: acc.onTime + d.onTime },
                { received: 0, onTime: 0 },
              );
      quotaBacked.received += regionQuotaBacked.received;
      quotaBacked.onTime += regionQuotaBacked.onTime;

      const regionMetrics = withQuotaScope(
        buildMetrics(region.target, summedCounts, summedStock),
        regionQuotaBacked,
      );
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
      if (centralQuota?.submissionTarget != null) {
        quotaBacked.received += centralCounts.received;
        quotaBacked.onTime += centralCounts.onTime;
      }
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

      // addMetrics sums the actuals and the quotas that are set; the rates and
      // the gap are then re-derived over the quota-backed returns alone, so the
      // `unassigned` bucket and any territory without a quota cannot inflate
      // them.
      totals = withQuotaScope(
        allMetrics.reduce((acc, m) => addMetrics(acc, m), emptyMetrics()),
        quotaBacked,
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
    await this.writeAdministrationQuota(tx, actorId, campaignId, parsed.central);
  }

  /**
   * Writes the campaign's ADMINISTRATION quota: the target for the ministry
   * cohort, which answers as one national respondent group and is excluded
   * from every territorial bucket in getCampaignReturns.
   *
   * Symmetric to applyCentral, which still serves CentralInscriptionTarget,
   * but writes into CampaignQuota rather than the deprecated
   * CentralCampaignQuota. The row carries no region and no department; one per
   * campaign, enforced by campaign_quotas_administration_uidx, with the shape
   * enforced by campaign_quotas_scope_shape.
   */
  private async writeAdministrationQuota(
    tx: Prisma.TransactionClient,
    actorId: string,
    campaignId: string,
    value: number | null | undefined,
  ): Promise<void> {
    if (value === undefined) return;
    const where = { campaignId, scopeKind: 'ADMINISTRATION' } as const;
    const details = { campaignId, scopeKind: 'ADMINISTRATION' };
    const existing = await tx.campaignQuota.findFirst({ where });
    if (value === null) {
      if (!existing) return;
      await tx.campaignQuota.delete({ where: { id: existing.id } });
      await writeAudit(
        tx, actorId, PilotageAuditAction.CAMPAIGN_QUOTA_DELETE, 'CampaignQuota',
        existing.id, existing.submissionTarget, null, details,
      );
      return;
    }
    if (existing && existing.submissionTarget === value) return;
    if (existing) {
      await tx.campaignQuota.update({
        where: { id: existing.id },
        data: { submissionTarget: value, updatedBy: actorId },
      });
      await writeAudit(
        tx, actorId, PilotageAuditAction.CAMPAIGN_QUOTA_UPSERT, 'CampaignQuota',
        existing.id, existing.submissionTarget, value, details,
      );
      return;
    }
    const created = await tx.campaignQuota.create({
      data: {
        campaignId,
        scopeKind: 'ADMINISTRATION',
        regionId: null,
        departmentId: null,
        submissionTarget: value,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await writeAudit(
      tx, actorId, PilotageAuditAction.CAMPAIGN_QUOTA_UPSERT, 'CampaignQuota',
      created.id, null, value, details,
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
      const existing = await table.findMany({ where: { ...scope, regionId, ...scopedWhere(delegate) } });
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
            data: { [field]: entry.target, updatedBy: actorId, ...scopedWhere(delegate) },
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
              ...scopedWhere(delegate),
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

/**
 * Every quarter, for the annual roll-up.
 *
 * Spelled out rather than expressed as "any quarter" so the campaign query
 * carries a positive predicate: a campaign whose referenceQuarter is NULL is
 * excluded by construction and cannot contribute to an annual sum.
 */
const ANNUAL_QUARTERS = [1, 2, 3, 4] as const;

function semesterQuarters(semester: number): readonly number[] {
  if (semester === 1) return [1, 2];
  if (semester === 2) return [3, 4];
  throw new BadRequestException('Le semestre doit valoir 1 ou 2.');
}

function semesterOf(quarter: number): number {
  return quarter <= 2 ? 1 : 2;
}

/**
 * Collapses the folded period's quota rows to one row per territory.
 *
 * loadGrid reads a department's target with `find`, not a sum, so handing it
 * four per-campaign rows for the same department would report Q1's figure on
 * the department line while summarizeRegion summed all four on the region
 * line. Pre-aggregating per (regionId, departmentId) is what makes the two
 * agree.
 *
 * It is also what produces an honest MIXED: a region with a region-level Q1
 * row and a department-level Q2 row keeps two distinct keys — departmentId
 * null and departmentId set — so summarizeRegion sees both and reports MIXED
 * with a null target rather than adding incomparable rows together.
 */
function foldQuotas(
  rows: Array<{ regionId: string; departmentId: string | null; submissionTarget: number }>,
): Array<{ regionId: string; departmentId: string | null; target: number }> {
  const folded = new Map<string, { regionId: string; departmentId: string | null; target: number }>();
  for (const row of rows) {
    const key = `${row.regionId}\u0000${row.departmentId ?? ''}`;
    const current = folded.get(key);
    if (current) current.target += row.submissionTarget;
    else folded.set(key, { regionId: row.regionId, departmentId: row.departmentId, target: row.submissionTarget });
  }
  return [...folded.values()];
}

/**
 * Sums the quota rows of a folded period, or null when there are none.
 *
 * Zero is data and absent is not: a quarter with a quota of 0 states a target
 * of zero, while a quarter with no quota row states nothing. No zero-padding,
 * so an annual figure is the sum of only the quarters that have quotas, and a
 * period with none reads as "—" rather than as a target of 0 that nothing
 * can ever be measured against.
 */
function sumTargets(rows: Array<{ submissionTarget: number }>): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((total, row) => total + row.submissionTarget, 0);
}

function requireActor(actorId: string): void {
  if (typeof actorId !== 'string' || actorId.trim() === '') throw new UnauthorizedException();
}

/**
 * The scopeKind discriminator for the campaign-quota table, written out rather
 * than left to the column default.
 *
 * CampaignQuota holds both TERRITORIAL rows and the one ADMINISTRATION row per
 * campaign, so every territorial read and write has to say which it means.
 * TerritoryTarget has no such column. Sending the value explicitly on create
 * and update — instead of relying on @default(TERRITORIAL) — keeps the row the
 * ORM returns identical to the row the database stores, which a default the
 * client never sends does not.
 */
function scopedWhere(delegate: ScopedDelegate): { scopeKind?: 'TERRITORIAL' } {
  return delegate === 'campaignQuota' ? { scopeKind: 'TERRITORIAL' } : {};
}

/**
 * Narrows a quota row to one that carries a region.
 *
 * CampaignQuota.regionId is nullable only to admit the single ADMINISTRATION
 * row per campaign, which targets the ministry cohort and belongs to no
 * territory.
 *
 * This predicate is the load-bearing guard, not the `scopeKind: 'TERRITORIAL'`
 * filter on the queries: campaign_quotas_scope_shape makes regionId NULL
 * equivalent to scopeKind = ADMINISTRATION, so narrowing on the region alone
 * already excludes the cohort row. The two are redundant on purpose. This one
 * is enforced by the compiler, because loadGrid's callback demands
 * `regionId: string` and nothing else can satisfy it; the scopeKind filter
 * narrows the query at the database and states the intent at the call site.
 * Removing this predicate is a type error. Removing that filter is not, which
 * is why the guard lives here.
 */
function hasRegion<T extends { regionId: string | null }>(row: T): row is T & { regionId: string } {
  return row.regionId !== null;
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

/**
 * Re-derives the quota-relative fields of a rollup from the quota-backed
 * returns alone.
 *
 * `received`, `approved`, `onTime` and `late` stay the true actuals of the
 * whole territory. A department or region with no quota set still contributes
 * to those, but it must contribute to neither side of `quotaRate`,
 * `onTimeRate` or `gap`: it adds nothing to the denominator (its quota is
 * unknown, not zero), so counting its returns in the numerator measured them
 * against other territories' quotas and overstated the rate while hiding part
 * of the gap.
 */
function withQuotaScope(
  metrics: ReturnMetrics,
  backed: { received: number; onTime: number },
): ReturnMetrics {
  const quota = metrics.quota;
  // No quota anywhere in the rollup: the three fields are already null.
  if (quota === null) return metrics;
  return {
    ...metrics,
    gap: Math.max(0, quota - backed.received),
    quotaRate: quota > 0 ? backed.received / quota : null,
    onTimeRate: quota > 0 ? backed.onTime / quota : null,
  };
}
