// src/questionnaires/eligibility-engine.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NOT_ARCHIVED, archiveState } from '../common/archive-predicate';
import {
  AnomalyResolutionType,
  AnomalyStatus,
  OnefopStatus,
  UserRole,
} from '@prisma/client';
import {
  DossierDiagnostic,
  PilotageQueues,
  ReviewDelay,
  StatisticalExclusionReason,
} from '../types/eligibility.types';
import { BulkVisaDto, BulkRejectDto, BulkRequestCorrectionDto, ResolveAnomalyDto } from '../dto/admin-dossier.dto';
import { assertTerritorialAuthority, Territory, territoryWhere } from '../auth/territory';
import { syncCampaignSubmissionOnReview } from './campaign-review-sync';
import { coherenceFlagToAnomaly } from './coherence-anomaly';
import {
  REVIEW_DELAY_THRESHOLD_DAYS,
  REVIEW_DELAY_WINDOW_DAYS,
  reviewOverdueBefore,
} from './review-delay';

// Kept exported for existing callers; the definitions live in review-delay.ts
// so the dossier list's overdue filter cannot drift from this queue.
export { REVIEW_DELAY_THRESHOLD_DAYS, REVIEW_DELAY_WINDOW_DAYS };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

@Injectable()
export class EligibilityEngineService {
  private readonly logger = new Logger(EligibilityEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure deterministic projection of Axis 1 (Administrative) and Axis 2 (Quality)
   * into Axis 3 (Statistical Eligibility). Axis 3 is NEVER directly written to DB.
   */
  async evaluateDossier(submissionId: string, territory?: Territory, includeArchived = false): Promise<DossierDiagnostic> {
    // Out-of-territory dossiers are reported as not found (no existence leak).
    // `submissionId` may be the dossier id or the receipt's reference (F12).
    const submission = await this.prisma.onefopSubmission.findFirst({
      where: { AND: [{ OR: [{ id: submissionId }, { submissionId }] }, territoryWhere(territory), archiveState(includeArchived)] },
      include: {
        anomalies: {
          orderBy: { detectedAt: 'desc' },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Dossier #${submissionId} introuvable.`);
    }
    if ((submission as any).archivedAt) {
      throw new BadRequestException('Cette fiche est archivée.');
    }

    if (
      submission.anomalies.length === 0 &&
      Array.isArray((submission as any).flags) &&
      (submission as any).flags.length > 0
    ) {
      try {
        const flags = (submission as any).flags as Array<{ code: string; message: string }>;
        await this.prisma.onefopAnomaly.createMany({
          data: flags.map((flag) => coherenceFlagToAnomaly(submission.id, flag)),
        });
        submission.anomalies = await this.prisma.onefopAnomaly.findMany({
          where: { submissionId: submission.id },
          orderBy: { detectedAt: 'desc' },
        });
      } catch (err: any) {
        this.logger.warn(`Could not sync anomalies for submission ${submission.id}: ${err?.message}`);
      }
    }

    const openAnomalies = submission.anomalies.filter((a) => a.status === AnomalyStatus.OPEN);
    const blockingAnomalies = openAnomalies.filter((a) => a.isBlocking);
    const warningAnomalies = openAnomalies.filter((a) => !a.isBlocking);

    // Rule 1: Open blocking anomalies strictly exclude the dossier from official statistics
    if (blockingAnomalies.length > 0) {
      return {
        submissionId: submission.id,
        axis1Status: submission.status,
        axis2BlockingCount: blockingAnomalies.length,
        axis2WarningCount: warningAnomalies.length,
        axis3Eligibility: 'EXCLUDED',
        exclusionReason: StatisticalExclusionReason.EXCL_BLOCKING_ANOMALY_OPEN,
        blockingAnomalies,
        warningAnomalies,
      };
    }

    // Rule 2: Administrative Axis Checks
    if (submission.status === OnefopStatus.DRAFT) {
      return {
        submissionId: submission.id,
        axis1Status: submission.status,
        axis2BlockingCount: 0,
        axis2WarningCount: warningAnomalies.length,
        axis3Eligibility: 'EXCLUDED',
        exclusionReason: StatisticalExclusionReason.EXCL_DRAFT_ONLY,
        blockingAnomalies: [],
        warningAnomalies,
      };
    }

    if (submission.status === OnefopStatus.CORRECTION_REQUESTED) {
      return {
        submissionId: submission.id,
        axis1Status: submission.status,
        axis2BlockingCount: 0,
        axis2WarningCount: warningAnomalies.length,
        axis3Eligibility: 'EXCLUDED',
        exclusionReason: StatisticalExclusionReason.EXCL_CORRECTION_PENDING,
        blockingAnomalies: [],
        warningAnomalies,
      };
    }

    if (submission.status === OnefopStatus.PENDING_REVIEW) {
      return {
        submissionId: submission.id,
        axis1Status: submission.status,
        axis2BlockingCount: 0,
        axis2WarningCount: warningAnomalies.length,
        axis3Eligibility: 'EXCLUDED',
        exclusionReason: StatisticalExclusionReason.EXCL_WAITING_NAT_VISA,
        blockingAnomalies: [],
        warningAnomalies,
      };
    }

    if (submission.status === OnefopStatus.REJECTED) {
      return {
        submissionId: submission.id,
        axis1Status: submission.status,
        axis2BlockingCount: 0,
        axis2WarningCount: warningAnomalies.length,
        axis3Eligibility: 'EXCLUDED',
        exclusionReason: StatisticalExclusionReason.EXCL_REJECTED,
        blockingAnomalies: [],
        warningAnomalies,
      };
    }

    // Replaced by a newer submission: its replacement is the one that counts.
    // It used to fall through to EXCL_REJECTED below, which it is not.
    if (submission.status === OnefopStatus.SUPERSEDED) {
      return {
        submissionId: submission.id,
        axis1Status: submission.status,
        axis2BlockingCount: 0,
        axis2WarningCount: warningAnomalies.length,
        axis3Eligibility: 'EXCLUDED',
        exclusionReason: StatisticalExclusionReason.EXCL_SUPERSEDED,
        blockingAnomalies: [],
        warningAnomalies,
      };
    }

    if (submission.status === OnefopStatus.APPROVED) {
      // Both Axis 1 (Approved) AND Axis 2 (0 blocking anomalies) are satisfied
      return {
        submissionId: submission.id,
        axis1Status: submission.status,
        axis2BlockingCount: 0,
        axis2WarningCount: warningAnomalies.length,
        axis3Eligibility: 'READY',
        blockingAnomalies: [],
        warningAnomalies,
      };
    }

    return {
      submissionId: submission.id,
      axis1Status: submission.status,
      axis2BlockingCount: blockingAnomalies.length,
      axis2WarningCount: warningAnomalies.length,
      axis3Eligibility: 'EXCLUDED',
      exclusionReason: StatisticalExclusionReason.EXCL_REJECTED,
      blockingAnomalies,
      warningAnomalies,
    };
  }

  /**
   * Returns the canonical Prisma `where` clause for statistically eligible ONEFOP submissions:
   * Axis 1 (status = APPROVED) AND Axis 2 (no OPEN BLOCKING anomalies).
   *
   * Shared by the SPSS/CSV streaming export, Excel streaming export, and analytical pipelines
   * to guarantee that APPROVED + OPEN BLOCKING records are never exported or counted.
   */
  static getStatisticalEligibilityWhere(): {
    status: OnefopStatus;
    anomalies: {
      none: {
        status: AnomalyStatus;
        isBlocking: boolean;
      };
    };
  } {
    return {
      status: OnefopStatus.APPROVED,
      anomalies: {
        none: {
          status: AnomalyStatus.OPEN,
          isBlocking: true,
        },
      },
    };
  }

  getStatisticalEligibilityWhere() {
    return EligibilityEngineService.getStatisticalEligibilityWhere();
  }

  /**
   * Deterministic predicate: returns true if and only if:
   * 1. Axis 1 is satisfied: submission status is APPROVED
   * 2. Axis 2 is satisfied: no OPEN BLOCKING anomalies exist
   */
  isStatisticallyEligible(submission: {
    status: OnefopStatus | string;
    anomalies?: Array<{ isBlocking: boolean; status: AnomalyStatus | string }>;
  }): boolean {
    if (submission.status !== OnefopStatus.APPROVED) {
      return false;
    }
    const hasOpenBlocking = (submission.anomalies ?? []).some(
      (a) => a.status === AnomalyStatus.OPEN && a.isBlocking,
    );
    return !hasOpenBlocking;
  }

  /**
   * Asserts that a dossier can be administratively approved (Axis 1 Visa).
   * A dossier CANNOT be approved while it has an OPEN + BLOCKING anomaly.
   * Throws BadRequestException if any open blocking anomalies are present.
   */
  async assertCanApprove(submissionId: string): Promise<DossierDiagnostic> {
    const diagnostic = await this.evaluateDossier(submissionId);
    if (diagnostic.blockingAnomalies.length > 0) {
      throw new BadRequestException(
        `Impossible d'approuver le dossier #${submissionId} : ${diagnostic.blockingAnomalies.length} anomalie(s) bloquante(s) non résolue(s).`,
      );
    }
    return diagnostic;
  }

  /**
   * Action-oriented work queues powering "Que dois-je traiter aujourd'hui ?"
   * Scoped by territory if the user is regional or divisional.
   */
  // ADR-0001 / Phase 1: getPilotageQueues is view-aware via view
  // (queue | completed | all). Completed includes SUPERSEDED; queue excludes it.
  // Counts are territory-scoped and ignore type/region/period/search filters.
  // See docs/plans/admin-modules-phase1-contract.md C.2.
  async getPilotageQueues(
    territory?: Territory,
    view: PilotageQueues['countsView'] | string = 'all',
    includeArchived = view === 'completed',
  ): Promise<PilotageQueues> {
    if (!['queue', 'completed', 'all'].includes(view)) {
      throw new BadRequestException(`Unknown dossier counts view: ${view}.`);
    }
    const countsView = view as PilotageQueues['countsView'];
    // Drafts are respondents' unsubmitted work. Queue/all preserve the
    // current status set; completed deliberately counts terminal decisions,
    // including replaced records (SUPERSEDED).
    const statusFilter = countsView === 'completed'
      ? { status: { in: [OnefopStatus.APPROVED, OnefopStatus.REJECTED, OnefopStatus.SUPERSEDED] } }
      : { status: { notIn: [OnefopStatus.DRAFT, OnefopStatus.SUPERSEDED] } };
    const baseWhere: any = {
      AND: [territoryWhere(territory), statusFilter, archiveState(includeArchived)],
    };

    // Kept deliberately narrow: four round trips, never more than two at once.
    //
    // DATABASE_URL points at Supabase's pooler in *session* mode, where each
    // client connection pins a backend for its whole life and the tenant pool
    // is capped (pool_size 15). Prisma grows its own pool to meet concurrent
    // demand, so a `Promise.all` of N queries forces N connections open at
    // once. The admin dashboard refetches this endpoint plus the quality
    // summary every 30s from every open tab, which drove the pool to its
    // ceiling and surfaced as `EMAXCONNSESSION ... max clients reached in
    // session mode`. The four queries therefore run as two pairs.
    //
    // The three per-status counts that used to be separate `count()` calls are
    // derived from the status groupBy instead. OnefopStatus has exactly five
    // members and `baseWhere` excludes DRAFT, so the four remaining buckets
    // partition the result set exactly and the total is their sum — identical
    // figures, no extra connections. Do not reintroduce the separate counts
    // without re-checking that invariant against the enum.
    const [statusGroups, regionGroups] = await Promise.all([
      // Dashboard aggregates are computed here, over the whole territory, so
      // the client never derives national figures from a paginated list.
      this.prisma.onefopSubmission.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.onefopSubmission.groupBy({
        by: ['region'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);
    const [blockingAnomaliesCount, statisticallyReadyCount] = await Promise.all([
      this.prisma.onefopAnomaly.count({
        where: {
          status: AnomalyStatus.OPEN,
          isBlocking: true,
          submission: baseWhere,
        },
      }),
      // Statistically ready = APPROVED and ZERO open blocking anomalies.
      // Counted in the database rather than by fetching every approved row
      // and filtering in process.
      this.prisma.onefopSubmission.count({
        where: {
          ...baseWhere,
          status: OnefopStatus.APPROVED,
          anomalies: { none: { status: AnomalyStatus.OPEN, isBlocking: true } },
        },
      }),
    ]);

    const statusCounts: PilotageQueues['statusCounts'] = {
      PENDING_REVIEW: 0,
      APPROVED: 0,
      CORRECTION_REQUESTED: 0,
      REJECTED: 0,
      SUPERSEDED: 0,
    };
    let totalSubmissionsCount = 0;
    for (const g of statusGroups) {
      totalSubmissionsCount += g._count._all;
      if (g.status in statusCounts) statusCounts[g.status as keyof typeof statusCounts] = g._count._all;
    }
    const regionCounts = regionGroups.map((g) => ({ region: g.region, count: g._count._all }));

    const reviewDelay = await this.getReviewDelay(territory);

    return {
      countsView,
      totalSubmissionsCount,
      blockingAnomaliesCount,
      pendingNationalVisasCount: statusCounts.PENDING_REVIEW,
      correctionsUnderReviewCount: statusCounts.CORRECTION_REQUESTED,
      statisticallyReadyCount,
      statusCounts,
      approvedCount: statusCounts.APPROVED,
      regionCounts,
      reviewDelay,
    };
  }

  /**
   * Review pace for getPilotageQueues: the age of the oldest file awaiting a
   * decision, how many have waited past the threshold, and the median time
   * from submission to decision. Two pairs of queries, never more than two in
   * flight (see the pool note in getPilotageQueues).
   */
  private async getReviewDelay(territory?: Territory, now: Date = new Date()): Promise<ReviewDelay> {
    const pendingWhere = { AND: [territoryWhere(territory), { status: OnefopStatus.PENDING_REVIEW }, NOT_ARCHIVED] };
    const overdueBefore = reviewOverdueBefore(now);
    const windowStart = new Date(now.getTime() - REVIEW_DELAY_WINDOW_DAYS * DAY_MS);

    const [oldest, pendingOverThresholdCount] = await Promise.all([
      this.prisma.onefopSubmission.aggregate({
        where: pendingWhere,
        _min: { submissionDate: true },
      }),
      this.prisma.onefopSubmission.count({
        where: { AND: [...pendingWhere.AND, { submissionDate: { lt: overdueBefore } }] },
      }),
    ]);

    // A decision sets reviewedAt. A replaced file (SUPERSEDED) keeps the
    // reviewedAt of the correction request that preceded it, so it counts.
    // Reopening an endorsed file also rewrites reviewedAt, to the reopening:
    // those files are left out, as their reviewedAt is no longer a decision.
    // Only two dates per file are read, over a bounded window.
    const [decided, reopenings] = await Promise.all([
      this.prisma.onefopSubmission.findMany({
        where: {
          AND: [
            territoryWhere(territory),
            {
              status: {
                in: [
                  OnefopStatus.APPROVED,
                  OnefopStatus.REJECTED,
                  OnefopStatus.CORRECTION_REQUESTED,
                  OnefopStatus.SUPERSEDED,
                ],
              },
            },
            { reviewedAt: { gte: windowStart } },
            NOT_ARCHIVED,
          ],
        },
        select: { id: true, submissionDate: true, reviewedAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: { action: 'AUDIT_REOPEN', resourceType: 'OnefopSubmission', timestamp: { gte: windowStart } },
        select: { resourceId: true },
      }),
    ]);

    const reopened = new Set(reopenings.map((r) => r.resourceId));
    const durations = decided
      .filter((d) => d.reviewedAt && !reopened.has(d.id))
      .map((d) => Math.max(0, d.reviewedAt!.getTime() - d.submissionDate.getTime()) / DAY_MS);

    return {
      thresholdDays: REVIEW_DELAY_THRESHOLD_DAYS,
      oldestPendingSubmittedAt: oldest._min.submissionDate ? oldest._min.submissionDate.toISOString() : null,
      pendingOverThresholdCount,
      windowDays: REVIEW_DELAY_WINDOW_DAYS,
      decidedMedianDays: durations.length ? Math.round(median(durations) * 10) / 10 : null,
      decidedCount: durations.length,
    };
  }

  /**
   * Authoritative quality summary indicators and anomaly aggregates,
   * scoped to territory and optional campaign.
   */
  async getQualitySummary(territory?: Territory, campaignId?: string) {
    const baseWhere: any = {
      AND: [
        territoryWhere(territory),
        NOT_ARCHIVED,
        // Not drafts, and not replaced files: see getPilotageQueues.
        { status: { notIn: [OnefopStatus.DRAFT, OnefopStatus.SUPERSEDED] } },
        ...(campaignId ? [{ campaignId }] : []),
      ],
    };

    // At most three queries in flight at once (was ten in one Promise.all).
    // See getPilotageQueues: the pooler runs in session mode with a tenant
    // pool of 15, and Prisma opens one connection per concurrent query, so a
    // wide fan-out on a dashboard that refetches every 30s exhausted it.
    //
    // Two pairs of counts are folded into groupBys over the same filter:
    //  - total and in-correction submissions come from one status groupBy
    //    (the buckets of a groupBy partition its `where`, so their sum is the
    //    count, and the CORRECTION_REQUESTED bucket is the filtered count);
    //  - open blocking and open non-blocking anomaly counts come from one
    //    groupBy on `isBlocking` (a non-nullable boolean: two buckets).
    const [statusGroups, openAnomalyGroups, statisticallyReadyCount] = await Promise.all([
      this.prisma.onefopSubmission.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.onefopAnomaly.groupBy({
        by: ['isBlocking'],
        where: {
          status: AnomalyStatus.OPEN,
          submission: baseWhere,
        },
        _count: { _all: true },
      }),
      // Counted in the database rather than by fetching every approved row and
      // filtering in process: the old findMany pulled one row per approved
      // submission on every 30s dashboard refetch.
      this.prisma.onefopSubmission.count({
        where: {
          ...baseWhere,
          status: OnefopStatus.APPROVED,
          anomalies: { none: { status: AnomalyStatus.OPEN, isBlocking: true } },
        },
      }),
    ]);

    const [
      submissionsWithBlockingAnomalies,
      submissionsWithWarnings,
      submissionsWithCoherenceAnomalies,
    ] = await Promise.all([
      this.prisma.onefopSubmission.count({
        where: {
          ...baseWhere,
          anomalies: { some: { status: AnomalyStatus.OPEN, isBlocking: true } },
        },
      }),
      this.prisma.onefopSubmission.count({
        where: {
          ...baseWhere,
          anomalies: { some: { status: AnomalyStatus.OPEN, isBlocking: false } },
        },
      }),
      this.prisma.onefopSubmission.count({
        where: {
          ...baseWhere,
          anomalies: {
            some: {
              status: AnomalyStatus.OPEN,
              ruleFamily: { in: ['COHERENCE', 'VT_COHERENCE', 'ARITHMETIC'] },
            },
          },
        },
      }),
    ]);

    const [familyGroups, anomalyRegions] = await Promise.all([
      this.prisma.onefopAnomaly.groupBy({
        by: ['ruleFamily'],
        where: {
          status: AnomalyStatus.OPEN,
          submission: baseWhere,
        },
        _count: { _all: true },
        orderBy: { _count: { ruleFamily: 'desc' } },
      }),
      this.prisma.onefopAnomaly.findMany({
        where: {
          status: AnomalyStatus.OPEN,
          submission: baseWhere,
        },
        select: {
          submission: {
            select: { region: true },
          },
        },
      }),
    ]);

    let totalSubmissions = 0;
    let submissionsInCorrection = 0;
    for (const g of statusGroups) {
      totalSubmissions += g._count._all;
      if (g.status === OnefopStatus.CORRECTION_REQUESTED) submissionsInCorrection = g._count._all;
    }
    let blockingAnomaliesCount = 0;
    let warningsCount = 0;
    for (const g of openAnomalyGroups) {
      if (g.isBlocking) blockingAnomaliesCount += g._count._all;
      else warningsCount += g._count._all;
    }

    // Rates: 0-100% or null if 0 submissions
    const completenessRate = totalSubmissions > 0
      ? Math.max(0, Math.round(((totalSubmissions - submissionsInCorrection) / totalSubmissions) * 100))
      : null;

    const coherenceRate = totalSubmissions > 0
      ? Math.max(0, Math.round(((totalSubmissions - submissionsWithCoherenceAnomalies) / totalSubmissions) * 100))
      : null;

    const anomalyRate = totalSubmissions > 0
      ? Math.min(100, Math.round((submissionsWithBlockingAnomalies / totalSubmissions) * 100))
      : null;

    const warningRate = totalSubmissions > 0
      ? Math.min(100, Math.round((submissionsWithWarnings / totalSubmissions) * 100))
      : null;

    const statisticalEligibilityRate = totalSubmissions > 0
      ? Math.min(100, Math.round((statisticallyReadyCount / totalSubmissions) * 100))
      : null;

    const byRuleFamily = familyGroups.map((g) => ({
      ruleFamily: g.ruleFamily,
      count: g._count._all,
    }));

    const regionMap = new Map<string, number>();
    for (const a of anomalyRegions) {
      const reg = a.submission?.region?.trim() || 'Non assigné';
      regionMap.set(reg, (regionMap.get(reg) || 0) + 1);
    }
    const byRegion = Array.from(regionMap.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    return {
      completenessRate,
      coherenceRate,
      anomalyRate,
      warningRate,
      statisticalEligibilityRate,
      totalSubmissions,
      blockingAnomaliesCount,
      warningsCount,
      statisticallyReadyCount,
      byRuleFamily,
      byRegion,
    };
  }

  /**
   * Resolve or waive an anomaly with actor-based authorization and legal audit
   */
  async resolveAnomaly(anomalyId: string, actor: any, dto: ResolveAnomalyDto) {
    const anomaly = await this.prisma.onefopAnomaly.findUnique({
      where: { id: anomalyId },
      include: { submission: true },
    });

    if (!anomaly) {
      throw new NotFoundException(`Anomalie #${anomalyId} introuvable.`);
    }
    if ((anomaly.submission as any)?.archivedAt) {
      throw new BadRequestException('Cette fiche est archivée.');
    }

    if (anomaly.status !== AnomalyStatus.OPEN) {
      throw new BadRequestException(`Cette anomalie a déjà été traitée (${anomaly.status}).`);
    }

    // Strict Authorization check on LEGAL_DEROGATION
    if (dto.resolutionType === AnomalyResolutionType.LEGAL_DEROGATION) {
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN_ONEFOP, UserRole.ADMIN_ONEFOP];
      if (!allowedRoles.includes(actor.role)) {
        throw new ForbiddenException(
          'Seule la Direction Centrale ONEFOP ou le SuperAdmin National peut accorder une dispense légale (WAIVED).'
        );
      }
    }

    // Territorial scope check for field inspectors
    assertTerritorialAuthority(actor, anomaly.submission);

    const nextStatus = dto.resolutionType === AnomalyResolutionType.LEGAL_DEROGATION
      ? AnomalyStatus.WAIVED
      : AnomalyStatus.RESOLVED;

    const updated = await this.prisma.onefopAnomaly.update({
      where: { id: anomalyId },
      data: {
        status: nextStatus,
        resolutionType: dto.resolutionType,
        resolutionNote: dto.resolutionNote,
        evidenceUrl: dto.evidenceUrl ?? null,
        resolvedById: actor.id,
        resolvedAt: new Date(),
      },
    });

    // Write audit trail
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: nextStatus === AnomalyStatus.WAIVED ? 'ANOMALY_WAIVED' : 'ANOMALY_RESOLVED',
        resourceType: 'OnefopAnomaly',
        resourceId: anomaly.id,
        details: {
          ruleCode: anomaly.ruleCode,
          submissionId: anomaly.submissionId,
          resolutionType: dto.resolutionType,
          resolutionNote: dto.resolutionNote,
          evidenceUrl: dto.evidenceUrl,
        },
      },
    });

    return updated;
  }

  /**
   * Protected Transactional Bulk Visa
   * Re-evaluates every single requested submission inside a serializable transaction.
   * Does NOT blindly trust client-supplied ID lists.
   */
  async executeBulkVisa(actor: any, dto: BulkVisaDto) {
    if (!dto.certified) {
      throw new BadRequestException(
        'Le visa groupé requiert une certification et un engagement formel de la part de l\'officier ministériel.'
      );
    }

    if (!dto.submissionIds || dto.submissionIds.length === 0) {
      throw new BadRequestException('Aucun dossier sélectionné pour le visa groupé.');
    }

    // Campaign progress B4: filled per dossier in the loop below, applied
    // after commit. On PostgreSQL a failed statement aborts the interactive
    // transaction, so a CampaignSubmission error inside it would undo the
    // visa itself; outside it, the error is only logged.
    const campaignTargets: Array<{ id: string; campaignId: string | null; establishmentId: string | null; companyId: string | null }> = [];

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch all requested dossiers with open blocking anomalies and territorial fields
      const candidates = await tx.onefopSubmission.findMany({
        where: { id: { in: dto.submissionIds } },
        include: {
          anomalies: {
            where: { status: AnomalyStatus.OPEN, isBlocking: true },
          },
        },
      });

      const approvedIds: string[] = [];
      const rejectedItems: Array<{ id: string; reason: string }> = [];

      // IDs not returned by findMany were either missing or already filtered by DB.
      // Report them with the same message used for out-of-territory rows (no info leak).
      const foundSet = new Set(candidates.map((c) => c.id));
      for (const requestedId of dto.submissionIds) {
        if (!foundSet.has(requestedId)) {
          rejectedItems.push({ id: requestedId, reason: 'Dossier introuvable ou hors ressort.' });
        }
      }

      for (const candidate of candidates) {
        // Condition A (FIRST): Territorial jurisdiction check.
        // Out-of-territory rows get the same generic message as missing rows — no leak.
        try {
          assertTerritorialAuthority(actor, candidate);
        } catch {
          rejectedItems.push({ id: candidate.id, reason: 'Dossier introuvable ou hors ressort.' });
          continue;
        }

        // Condition B: Must be in PENDING_REVIEW
        if (candidate.status !== OnefopStatus.PENDING_REVIEW) {
          rejectedItems.push({
            id: candidate.id,
            reason: `Statut administratif invalide (${candidate.status} au lieu de PENDING_REVIEW).`,
          });
          continue;
        }

        // Condition C: Zero open blocking anomalies (Axe 2 Quality condition)
        if (candidate.anomalies.length > 0) {
          rejectedItems.push({
            id: candidate.id,
            reason: `${candidate.anomalies.length} anomalie(s) bloquante(s) non résolue(s).`,
          });
          continue;
        }

        approvedIds.push(candidate.id);
        campaignTargets.push({
          id: candidate.id,
          campaignId: candidate.campaignId,
          establishmentId: candidate.establishmentId,
          companyId: candidate.companyId,
        });
      }

      // 2. Atomically update all verified clean candidates.
      // The status condition inside the where re-checks status atomically,
      // preventing a concurrent action between our read and this write.
      if (approvedIds.length > 0) {
        await tx.onefopSubmission.updateMany({
          where: { id: { in: approvedIds }, status: OnefopStatus.PENDING_REVIEW },
          data: {
            status: OnefopStatus.APPROVED,
            reviewedBy: actor.id,
            reviewedAt: new Date(),
          },
        });

        // 3. Write permanent Ministerial Audit event
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'AUDIT_BULK_VISA_GRANTED',
            resourceType: 'OnefopSubmission',
            resourceId: `BULK_${Date.now()}`,
            details: {
              actorRole: actor.role,
              actorEmail: actor.email,
              totalRequested: dto.submissionIds.length,
              processedCount: approvedIds.length,
              rejectedCount: rejectedItems.length,
              approvedIds,
              rejectedItems,
              notes: dto.notes ?? null,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }

      return {
        success: true,
        processedCount: approvedIds.length,
        rejectedCount: rejectedItems.length,
        approvedIds,
        rejectedItems,
        timestamp: new Date().toISOString(),
      };
    });

    for (const target of campaignTargets) {
      await syncCampaignSubmissionOnReview(this.prisma, this.logger, target, 'VALIDATED');
    }
    return result;
  }

  /**
   * Protected Transactional Bulk Reject
   * Mirrors executeBulkVisa: territory check first, one transaction, one audit record.
   * Rejectable statuses: PENDING_REVIEW and CORRECTION_REQUESTED only.
   */
  async executeBulkReject(actor: any, dto: BulkRejectDto) {
    if (!dto.certified) {
      throw new BadRequestException(
        'Le rejet groupé requiert une certification formelle de la part de l\'officier ministériel.',
      );
    }

    if (!dto.submissionIds || dto.submissionIds.length === 0) {
      throw new BadRequestException('Aucun dossier sélectionné pour le rejet groupé.');
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('La justification doit comporter au moins 10 caractères.');
    }

    // Campaign progress B4: same post-commit pattern as executeBulkVisa.
    const campaignTargets: Array<{ id: string; campaignId: string | null; establishmentId: string | null; companyId: string | null }> = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const candidates = await tx.onefopSubmission.findMany({
        where: { id: { in: dto.submissionIds } },
        select: {
          id: true,
          status: true,
          region: true,
          department: true,
          campaignId: true,
          establishmentId: true,
          companyId: true,
        },
      });

      const rejectableIds: string[] = [];
      const skippedItems: Array<{ id: string; reason: string }> = [];

      // Missing IDs — same message as out-of-territory (no info leak)
      const foundSet = new Set(candidates.map((c) => c.id));
      for (const requestedId of dto.submissionIds) {
        if (!foundSet.has(requestedId)) {
          skippedItems.push({ id: requestedId, reason: 'Dossier introuvable ou hors ressort.' });
        }
      }

      for (const candidate of candidates) {
        // Territory FIRST — out-of-territory rows get the same generic message
        try {
          assertTerritorialAuthority(actor, candidate);
        } catch {
          skippedItems.push({ id: candidate.id, reason: 'Dossier introuvable ou hors ressort.' });
          continue;
        }

        // Status precondition: only PENDING_REVIEW or CORRECTION_REQUESTED
        if (
          candidate.status !== OnefopStatus.PENDING_REVIEW &&
          candidate.status !== OnefopStatus.CORRECTION_REQUESTED
        ) {
          skippedItems.push({
            id: candidate.id,
            reason: `Statut administratif invalide (${candidate.status}).`,
          });
          continue;
        }

        rejectableIds.push(candidate.id);
        campaignTargets.push({
          id: candidate.id,
          campaignId: candidate.campaignId,
          establishmentId: candidate.establishmentId,
          companyId: candidate.companyId,
        });
      }

      if (rejectableIds.length > 0) {
        // Status condition inside where prevents concurrent overwrites
        await tx.onefopSubmission.updateMany({
          where: {
            id: { in: rejectableIds },
            status: { in: [OnefopStatus.PENDING_REVIEW, OnefopStatus.CORRECTION_REQUESTED] },
          },
          data: {
            status: OnefopStatus.REJECTED,
            rejectionReason: dto.reason,
            reviewedBy: actor.id,
            reviewedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'AUDIT_BULK_REJECT',
            resourceType: 'OnefopSubmission',
            resourceId: `BULK_${Date.now()}`,
            details: {
              actorRole: actor.role,
              actorEmail: actor.email,
              totalRequested: dto.submissionIds.length,
              rejectedCount: rejectableIds.length,
              skippedCount: skippedItems.length,
              rejectedIds: rejectableIds,
              skippedItems,
              reason: dto.reason,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }

      return {
        success: true,
        processedCount: rejectableIds.length,
        rejectedCount: skippedItems.length,
        rejectedIds: rejectableIds,
        rejectedItems: skippedItems,
        timestamp: new Date().toISOString(),
      };
    });

    for (const target of campaignTargets) {
      await syncCampaignSubmissionOnReview(this.prisma, this.logger, target, 'NOT_STARTED');
    }
    return result;
  }

  /**
   * Protected Transactional Bulk Request Correction.
   *
   * Mirrors executeBulkReject, but only PENDING_REVIEW files are eligible: a
   * file already awaiting its respondent's corrections is not asked twice.
   * Every corrected file gets its own AUDIT_CORRECTION row, the action the
   * pilotage history counts per file; a single bulk row would hide them.
   */
  async executeBulkRequestCorrection(actor: any, dto: BulkRequestCorrectionDto) {
    if (!dto.certified) {
      throw new BadRequestException(
        'La demande de correction groupée requiert une certification formelle de la part de l’officier ministériel.',
      );
    }

    if (!dto.submissionIds || dto.submissionIds.length === 0) {
      throw new BadRequestException('Aucun dossier sélectionné pour la demande de correction groupée.');
    }

    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('La justification doit comporter au moins 10 caractères.');
    }

    const campaignTargets: Array<{ id: string; campaignId: string | null; establishmentId: string | null; companyId: string | null }> = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const candidates = await tx.onefopSubmission.findMany({
        where: { id: { in: dto.submissionIds } },
        select: {
          id: true,
          status: true,
          region: true,
          department: true,
          campaignId: true,
          establishmentId: true,
          companyId: true,
        },
      });

      const correctedIds: string[] = [];
      const skippedItems: Array<{ id: string; reason: string }> = [];

      // Missing IDs — same message as out-of-territory (no info leak)
      const foundSet = new Set(candidates.map((c) => c.id));
      for (const requestedId of dto.submissionIds) {
        if (!foundSet.has(requestedId)) {
          skippedItems.push({ id: requestedId, reason: 'Dossier introuvable ou hors ressort.' });
        }
      }

      for (const candidate of candidates) {
        // Territory FIRST — out-of-territory rows get the same generic message
        try {
          assertTerritorialAuthority(actor, candidate);
        } catch {
          skippedItems.push({ id: candidate.id, reason: 'Dossier introuvable ou hors ressort.' });
          continue;
        }

        // Only a file still waiting for a first decision may be sent back.
        if (candidate.status !== OnefopStatus.PENDING_REVIEW) {
          skippedItems.push({
            id: candidate.id,
            reason: `Statut administratif invalide (${candidate.status}).`,
          });
          continue;
        }

        correctedIds.push(candidate.id);
        campaignTargets.push({
          id: candidate.id,
          campaignId: candidate.campaignId,
          establishmentId: candidate.establishmentId,
          companyId: candidate.companyId,
        });
      }

      if (correctedIds.length > 0) {
        // Status condition inside where prevents concurrent overwrites.
        await tx.onefopSubmission.updateMany({
          where: {
            id: { in: correctedIds },
            status: OnefopStatus.PENDING_REVIEW,
          },
          data: {
            status: OnefopStatus.CORRECTION_REQUESTED,
            rejectionReason: dto.reason,
            reviewedBy: actor.id,
            reviewedAt: new Date(),
          },
        });

        const timestamp = new Date().toISOString();
        for (const id of correctedIds) {
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              action: 'AUDIT_CORRECTION',
              resourceType: 'OnefopSubmission',
              resourceId: id,
              details: {
                comments: dto.reason,
                previousStatus: OnefopStatus.PENDING_REVIEW,
                certified: true,
                bulk: true,
                actorRole: actor.role,
                actorEmail: actor.email,
              },
            },
          });
        }
        // One summary row for the batch itself, as bulk visa and reject do.
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'AUDIT_BULK_REQUEST_CORRECTION',
            resourceType: 'OnefopSubmission',
            resourceId: `BULK_${Date.now()}`,
            details: {
              actorRole: actor.role,
              actorEmail: actor.email,
              totalRequested: dto.submissionIds.length,
              correctedCount: correctedIds.length,
              skippedCount: skippedItems.length,
              correctedIds,
              skippedItems,
              reason: dto.reason,
              timestamp,
            },
          },
        });
      }

      return {
        success: true,
        processedCount: correctedIds.length,
        skippedCount: skippedItems.length,
        correctedIds,
        skippedItems,
        timestamp: new Date().toISOString(),
      };
    });

    for (const target of campaignTargets) {
      await syncCampaignSubmissionOnReview(this.prisma, this.logger, target, 'IN_PROGRESS');
    }
    return result;
  }

  /**
   * Legacy `flags` -> `OnefopAnomaly` migration sweep, run before an anomaly
   * listing is served.
   *
   * `anomalies: { none: {} }` is the real duplicate guard: a submission that
   * already has anomaly rows can never be selected again, so the sweep is safe
   * to repeat. The previous gate was a global `onefopAnomaly.count() === 0`,
   * which stopped the sweep for good as soon as the live engine wrote its very
   * first anomaly row anywhere — every legacy submission still carrying only
   * `flags` was then skipped silently and for ever.
   *
   * To avoid paying for the scan on every read, the sweep latches off for the
   * lifetime of the process once a pass creates nothing: either the backlog is
   * drained, or what is left holds no usable flags. A restart clears the latch,
   * which costs one bounded scan per process. A backlog larger than the page
   * size is drained a page per read. `evaluateDossier` keeps doing the same
   * backfill for a single dossier on demand.
   */
  private legacyFlagSweepDone = false;
  private legacyFlagSweepInFlight: Promise<void> | null = null;

  private async backfillLegacyFlagAnomalies(): Promise<void> {
    if (this.legacyFlagSweepDone) return;
    // One pass at a time: concurrent reads would otherwise select the same
    // submissions and create their anomalies twice.
    if (this.legacyFlagSweepInFlight) return this.legacyFlagSweepInFlight;

    this.legacyFlagSweepInFlight = (async () => {
      try {
        const unmigrated = await this.prisma.onefopSubmission.findMany({
          where: {
            flags: { not: null as any },
            anomalies: { none: {} },
          },
          select: { id: true, flags: true },
          take: 100,
        });

        let created = 0;
        for (const sub of unmigrated) {
          if (Array.isArray(sub.flags) && sub.flags.length > 0) {
            const flags = sub.flags as Array<{ code: string; message: string }>;
            await this.prisma.onefopAnomaly.createMany({
              data: flags.map((flag) => coherenceFlagToAnomaly(sub.id, flag)),
            });
            created += flags.length;
          }
        }

        // Nothing migrated: a further pass would select the same rows and do
        // the same nothing.
        if (created === 0) this.legacyFlagSweepDone = true;
      } catch (err: any) {
        this.logger.warn(`Anomaly synchronization failed: ${err?.message}`);
      } finally {
        this.legacyFlagSweepInFlight = null;
      }
    })();

    return this.legacyFlagSweepInFlight;
  }

  /**
   * List anomalies with filtering and pagination
   */
  async listAnomalies(filters: {
    submissionId?: string;
    status?: AnomalyStatus;
    isBlocking?: boolean;
    ruleFamily?: string;
    limit?: number;
    offset?: number;
  }, territory?: Territory) {
    const where: any = {};
    if (filters.submissionId) where.submissionId = filters.submissionId;
    if (filters.status) where.status = filters.status;
    if (filters.isBlocking !== undefined) where.isBlocking = filters.isBlocking;
    if (filters.ruleFamily) where.ruleFamily = filters.ruleFamily;
    where.submission = { AND: [territoryWhere(territory), NOT_ARCHIVED] };

    await this.backfillLegacyFlagAnomalies();

    const [total, items] = await Promise.all([
      this.prisma.onefopAnomaly.count({ where }),
      this.prisma.onefopAnomaly.findMany({
        where,
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        orderBy: { detectedAt: 'desc' },
        include: {
          submission: {
            select: {
              id: true,
              submissionId: true,
              formType: true,
              region: true,
              department: true,
              company: { select: { name: true } },
            },
          },
          resolvedBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    return { total, items };
  }

  /**
   * Authoritative catalog of statistical and administrative validation rules
   * enforced by the ONEFOP eligibility and validation engines.
   */
  // Coherence rules are advisory (coherence-anomaly.ts, CLAUDE.md §7): their
  // anomalies are warnings and never block approval or export.
  getValidationRules() {
    return [
      {
        code: 'COHERENCE_TOTAL',
        name: 'Cohérence des Effectifs Totaux',
        family: 'COHERENCE',
        severity: 'WARNING',
        isBlocking: false,
        description: 'Vérifie que la somme des effectifs déclarés (hommes + femmes) égale l’effectif total de l’établissement.',
        enabled: true,
      },
      {
        code: 'COHERENCE_CSP',
        name: 'Cohérence Catégories Socio-Professionnelles (CSP)',
        family: 'COHERENCE',
        severity: 'WARNING',
        isBlocking: false,
        description: 'Vérifie la cohérence arithmétique entre la distribution par CSP et l’effectif global déclaré.',
        enabled: true,
      },
      {
        code: 'COHERENCE_NATIONALITY',
        name: 'Cohérence Nationalité Salariés',
        family: 'COHERENCE',
        severity: 'WARNING',
        isBlocking: false,
        description: 'Vérifie que la somme des effectifs nationaux et expatriés correspond aux totaux saisis.',
        enabled: true,
      },
      {
        code: 'VT_COHERENCE_LEARNERS',
        name: 'Flux Apprenants et Formateurs TVET',
        family: 'VT_COHERENCE',
        severity: 'WARNING',
        isBlocking: false,
        description: 'Contrôle la cohérence des effectifs d’apprenants inscrits, admis et certifiés par spécialité.',
        enabled: true,
      },
      {
        code: 'VT_INFRASTRUCTURE',
        name: 'Cohérence Capacités & Ateliers TVET',
        family: 'VT_COHERENCE',
        severity: 'WARNING',
        isBlocking: false,
        description: 'Vérifie la présence et le statut fonctionnel des ateliers et équipements déclarés.',
        enabled: true,
      },
      {
        code: 'COMPLETENESS_REQUIRED',
        name: 'Complétude Administrative Obligatoire',
        family: 'COMPLETENESS',
        severity: 'CRITICAL',
        isBlocking: true,
        description: 'Exige la présence des données d’identification, du répondant officiel et du rattachement territorial.',
        enabled: true,
      },
      {
        code: 'STATISTICAL_ELIGIBILITY',
        name: 'Éligibilité Statistique Nationale',
        family: 'ELIGIBILITY',
        severity: 'CRITICAL',
        isBlocking: true,
        description: 'Condition stricte : visa administratif accordé sans anomalie bloquante ouverte pour admission aux statistiques nationales.',
        enabled: true,
      },
    ];
  }
}
