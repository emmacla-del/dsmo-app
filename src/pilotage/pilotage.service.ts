import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, SubmissionModule } from '@prisma/client';
import { Territory } from '../auth/territory';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAndValidateTerritory } from '../territory/territory-resolver';
import { resolveTargetScope, TargetScope } from './pilotage-scope';
import {
  addCounts,
  applyRow,
  bucketKey,
  classifyBucket,
  CompanyStockRow,
  coverageRate,
  emptyCounts,
  StockCounts,
} from './pilotage-coverage';
import {
  assertEntryCount,
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
    assertEntryCount(parsed.entries.length, regionCount + departmentCount);
    for (const entry of parsed.entries) {
      if (entry.departmentId) {
        await resolveAndValidateTerritory(this.prisma, {
          regionId: entry.regionId,
          departmentId: entry.departmentId,
        });
      } else {
        const region = await this.prisma.region.findUnique({
          where: { id: entry.regionId },
          select: { id: true },
        });
        if (!region) throw new BadRequestException(`Région introuvable (ID: '${entry.regionId}').`);
      }
    }
  }

  private async writeInscriptions(
    tx: Prisma.TransactionClient,
    actorId: string,
    year: number,
    parsed: ParsedTargetBody,
  ): Promise<void> {
    await this.replaceScoped(
      tx, actorId, { year }, parsed.entries, 'territoryTarget', 'inscriptionTarget', 'TerritoryTarget',
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
      tx, actorId, { campaignId }, parsed.entries, 'campaignQuota', 'submissionTarget', 'CampaignQuota',
      PilotageAuditAction.CAMPAIGN_QUOTA_UPSERT, PilotageAuditAction.CAMPAIGN_QUOTA_DELETE,
    );
    await this.applyCentral(
      tx, actorId, { campaignId }, 'centralCampaignQuota', 'submissionTarget', parsed.central, 'CentralCampaignQuota',
      PilotageAuditAction.CENTRAL_CAMPAIGN_QUOTA_UPSERT, PilotageAuditAction.CENTRAL_CAMPAIGN_QUOTA_DELETE,
    );
  }

  /** Regions named in the payload are replaced. Every other region is left as stored. */
  private async replaceScoped(
    tx: Prisma.TransactionClient,
    actorId: string,
    scope: ScopeKey,
    entries: TargetEntry[],
    delegate: ScopedDelegate,
    field: TargetField,
    resourceType: string,
    upsertAction: string,
    deleteAction: string,
  ): Promise<void> {
    const byRegion = new Map<string, TargetEntry[]>();
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
      select: { id: true, name: true, code: true, collectionType: true, status: true },
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
