// src/types/eligibility.types.ts
import { AnomalySeverity, AnomalyStatus } from '@prisma/client';

export enum StatisticalExclusionReason {
  /** Blocking arithmetic, logic, or quota anomaly unresolved in Axis 2 */
  EXCL_BLOCKING_ANOMALY_OPEN = 'EXCL_BLOCKING_ANOMALY_OPEN',

  /** Declaration awaiting Divisional review (Délégation Départementale) */
  EXCL_WAITING_DIV_VISA = 'EXCL_WAITING_DIV_VISA',

  /** Declaration endorsed by Division, awaiting Regional visa (Délégation Régionale) */
  EXCL_WAITING_REG_VISA = 'EXCL_WAITING_REG_VISA',

  /** Declaration endorsed by Region, awaiting National Ministerial visa (ONEFOP Central) */
  EXCL_WAITING_NAT_VISA = 'EXCL_WAITING_NAT_VISA',

  /** Returned to establishment due to administrative rejection or unverified data */
  EXCL_CORRECTION_PENDING = 'EXCL_CORRECTION_PENDING',

  /** Declaration rejected definitively by inspectorate */
  EXCL_REJECTED = 'EXCL_REJECTED',

  /** Entity has only saved a local draft; not officially submitted */
  EXCL_DRAFT_ONLY = 'EXCL_DRAFT_ONLY',
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
  blockingAnomaliesCount: number;
  pendingNationalVisasCount: number;
  pendingRegionalVisasCount: number;
  pendingDivisionalVisasCount: number;
  correctionsUnderReviewCount: number;
  statisticallyReadyCount: number;
  totalSubmissionsCount: number;
  /** Submissions per administrative status, over the caller's whole territory. */
  statusCounts: Record<'PENDING_REVIEW' | 'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED', number>;
  /** Same figure as statusCounts.APPROVED, named for the pipeline's "Approuvées" stage. */
  approvedCount: number;
  /** Submissions per stored region value (null = no region recorded). */
  regionCounts: Array<{ region: string | null; count: number }>;
}
