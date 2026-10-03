// src/questionnaires/eligibility-engine.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnomalyResolutionType,
  AnomalySeverity,
  AnomalyStatus,
  OnefopStatus,
  UserRole,
} from '@prisma/client';
import {
  DossierDiagnostic,
  PilotageQueues,
  StatisticalExclusionReason,
} from '../types/eligibility.types';
import { BulkVisaDto, BulkRejectDto, ResolveAnomalyDto } from '../dto/admin-dossier.dto';
import { assertTerritorialAuthority, Territory, territoryWhere } from '../auth/territory';
import { syncCampaignSubmissionOnReview } from './campaign-review-sync';

@Injectable()
export class EligibilityEngineService {
  private readonly logger = new Logger(EligibilityEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure deterministic projection of Axis 1 (Administrative) and Axis 2 (Quality)
   * into Axis 3 (Statistical Eligibility). Axis 3 is NEVER directly written to DB.
   */
  async evaluateDossier(submissionId: string, territory?: Territory): Promise<DossierDiagnostic> {
    // Out-of-territory dossiers are reported as not found (no existence leak).
    const submission = await this.prisma.onefopSubmission.findFirst({
      where: { id: submissionId, ...territoryWhere(territory) },
      include: {
        anomalies: {
          orderBy: { detectedAt: 'desc' },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Dossier #${submissionId} introuvable.`);
    }

    if (
      submission.anomalies.length === 0 &&
      Array.isArray((submission as any).flags) &&
      (submission as any).flags.length > 0
    ) {
      try {
        const flags = (submission as any).flags as Array<{ code: string; message: string }>;
        await this.prisma.onefopAnomaly.createMany({
          data: flags.map((flag) => {
            const isBlocking = flag.code?.includes('BLOCKING') || flag.code?.includes('MISMATCH');
            return {
              submissionId: submission.id,
              ruleCode: flag.code || 'COHERENCE_MISMATCH',
              ruleFamily: flag.code?.startsWith('VT_') ? 'VT_COHERENCE' : 'COHERENCE',
              severity: isBlocking ? AnomalySeverity.CRITICAL : AnomalySeverity.WARNING,
              isBlocking: isBlocking ?? true,
              status: AnomalyStatus.OPEN,
              description: flag.message || 'Incohérence statistique détectée',
              observedValue: 'Incohérence détectée',
              expectedValue: 'Égalité requise',
            };
          }),
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
  async getPilotageQueues(territory?: Territory): Promise<PilotageQueues> {
    // Drafts are respondents' unsubmitted work: never counted as submissions.
    const baseWhere: any = { AND: [territoryWhere(territory), { status: { not: OnefopStatus.DRAFT } }] };

    const [
      totalSubmissionsCount,
      pendingNationalVisasCount,
      correctionsUnderReviewCount,
      blockingAnomaliesCount,
      approvedCandidates,
      statusGroups,
      regionGroups,
    ] = await Promise.all([
      this.prisma.onefopSubmission.count({ where: baseWhere }),
      this.prisma.onefopSubmission.count({
        where: { ...baseWhere, status: OnefopStatus.PENDING_REVIEW },
      }),
      this.prisma.onefopSubmission.count({
        where: { ...baseWhere, status: OnefopStatus.CORRECTION_REQUESTED },
      }),
      this.prisma.onefopAnomaly.count({
        where: {
          status: AnomalyStatus.OPEN,
          isBlocking: true,
          submission: baseWhere,
        },
      }),
      this.prisma.onefopSubmission.findMany({
        where: { ...baseWhere, status: OnefopStatus.APPROVED },
        select: {
          id: true,
          _count: {
            select: {
              anomalies: {
                where: { status: AnomalyStatus.OPEN, isBlocking: true },
              },
            },
          },
        },
      }),
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

    const statusCounts: PilotageQueues['statusCounts'] = {
      PENDING_REVIEW: 0,
      APPROVED: 0,
      CORRECTION_REQUESTED: 0,
      REJECTED: 0,
    };
    for (const g of statusGroups) {
      if (g.status in statusCounts) statusCounts[g.status as keyof typeof statusCounts] = g._count._all;
    }
    const regionCounts = regionGroups.map((g) => ({ region: g.region, count: g._count._all }));

    // Statistically ready = APPROVED and ZERO open blocking anomalies
    const statisticallyReadyCount = approvedCandidates.filter((s) => s._count.anomalies === 0).length;

    return {
      totalSubmissionsCount,
      blockingAnomaliesCount,
      pendingNationalVisasCount,
      pendingRegionalVisasCount: 0, // Always 0 — single-tier approval model, no waiting state.
      pendingDivisionalVisasCount: 0, // Always 0 — single-tier approval model, no waiting state.
      correctionsUnderReviewCount,
      statisticallyReadyCount,
      statusCounts,
      approvedCount: statusCounts.APPROVED,
      regionCounts,
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

    if (anomaly.status !== AnomalyStatus.OPEN) {
      throw new BadRequestException(`Cette anomalie a déjà été traitée (${anomaly.status}).`);
    }

    // Strict Authorization check on LEGAL_DEROGATION
    if (dto.resolutionType === AnomalyResolutionType.LEGAL_DEROGATION) {
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN_ONEFOP, UserRole.CENTRAL];
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
   * List anomalies with filtering and pagination
   */
  async listAnomalies(filters: {
    submissionId?: string;
    status?: AnomalyStatus;
    isBlocking?: boolean;
    limit?: number;
    offset?: number;
  }, territory?: Territory) {
    const where: any = {};
    if (filters.submissionId) where.submissionId = filters.submissionId;
    if (filters.status) where.status = filters.status;
    if (filters.isBlocking !== undefined) where.isBlocking = filters.isBlocking;
    where.submission = territoryWhere(territory);

    const totalExisting = await this.prisma.onefopAnomaly.count();
    if (totalExisting === 0) {
      try {
        const unmigrated = await this.prisma.onefopSubmission.findMany({
          where: {
            flags: { not: null as any },
            anomalies: { none: {} },
          },
          select: { id: true, flags: true },
          take: 100,
        });
        for (const sub of unmigrated) {
          if (Array.isArray(sub.flags) && sub.flags.length > 0) {
            const flags = sub.flags as Array<{ code: string; message: string }>;
            await this.prisma.onefopAnomaly.createMany({
              data: flags.map((flag) => {
                const isBlocking = flag.code?.includes('BLOCKING') || flag.code?.includes('MISMATCH');
                return {
                  submissionId: sub.id,
                  ruleCode: flag.code || 'COHERENCE_MISMATCH',
                  ruleFamily: flag.code?.startsWith('VT_') ? 'VT_COHERENCE' : 'COHERENCE',
                  severity: isBlocking ? AnomalySeverity.CRITICAL : AnomalySeverity.WARNING,
                  isBlocking: isBlocking ?? true,
                  status: AnomalyStatus.OPEN,
                  description: flag.message || 'Incohérence statistique détectée',
                  observedValue: 'Incohérence détectée',
                  expectedValue: 'Égalité requise',
                };
              }),
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Anomaly synchronization failed: ${err?.message}`);
      }
    }

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
}
