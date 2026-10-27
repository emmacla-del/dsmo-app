// src/types/eligibility.types.ts
import { AnomalySeverity, AnomalyStatus } from '@prisma/client';

export enum StatisticalExclusionReason {
  /** Blocking arithmetic, logic, or quota anomaly unresolved in Axis 2 */
  EXCL_BLOCKING_ANOMALY_OPEN = 'EXCL_BLOCKING_ANOMALY_OPEN',

  /** Declaration endorsed by Region, awaiting National Ministerial visa (ONEFOP Central) */
  EXCL_WAITING_NAT_VISA = 'EXCL_WAITING_NAT_VISA',

  /** Returned to establishment due to administrative rejection or unverified data */
  EXCL_CORRECTION_PENDING = 'EXCL_CORRECTION_PENDING',

  /** Declaration rejected definitively by inspectorate */
  EXCL_REJECTED = 'EXCL_REJECTED',

  /** Entity has only saved a local draft; not officially submitted */
  EXCL_DRAFT_ONLY = 'EXCL_DRAFT_ONLY',

  /** Closed: a newer submission for the same period replaced it (SUPERSEDED) */
  EXCL_SUPERSEDED = 'EXCL_SUPERSEDED',
}

export interface AnomalySummary {
  id: string;
  ruleCode: string;
  ruleFamily: string;
  severity: AnomalySeverity;
  isBlocking: boolean;
  status: AnomalyStatus;
  description: string;
  observedValue: string;
  expectedValue: string;
  deltaValue?: string | null;
  detectedAt: Date;
  resolutionType?: string | null;
  resolutionNote?: string | null;
}

export interface DossierDiagnostic {
  submissionId: string;
  axis1Status: string;
  axis2BlockingCount: number;
  axis2WarningCount: number;
  axis3Eligibility: 'READY' | 'EXCLUDED';
  exclusionReason?: StatisticalExclusionReason;
  blockingAnomalies: AnomalySummary[];
  warningAnomalies: AnomalySummary[];
}

export interface PilotageQueues {
  countsView: 'queue' | 'completed' | 'all';
  blockingAnomaliesCount: number;
  pendingNationalVisasCount: number;
  correctionsUnderReviewCount: number;
  statisticallyReadyCount: number;
  totalSubmissionsCount: number;
  /** Submissions per administrative status, over the caller's whole territory. */
  statusCounts: Record<'PENDING_REVIEW' | 'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED' | 'SUPERSEDED', number>;
  /** Same figure as statusCounts.APPROVED, named for the pipeline's "Approuvées" stage. */
  approvedCount: number;
  /** Submissions per stored region value (null = no region recorded). */
  regionCounts: Array<{ region: string | null; count: number }>;
  /** Whether review keeps up, over the same territory. */
  reviewDelay: ReviewDelay;
}

/**
 * Review pace. "Awaiting a decision" is PENDING_REVIEW for every role: ONEFOP
 * has one decision, taken by any staff role within its territory, so there is
 * no separate regional stage to measure.
 */
export interface ReviewDelay {
  /** A file waiting longer than this many days is counted as overdue. */
  thresholdDays: number;
  /** Submission date of the oldest file awaiting a decision; null when none waits. */
  oldestPendingSubmittedAt: string | null;
  /** Files awaiting a decision submitted more than `thresholdDays` days ago. */
  pendingOverThresholdCount: number;
  /** Days over which `decidedMedianDays` is measured, counted back from now. */
  windowDays: number;
  /** Median days from submission to decision, one decimal; null when nothing was decided. */
  decidedMedianDays: number | null;
  /** Decisions the median is computed over. */
  decidedCount: number;
}
