import { OnefopEntityType, OnefopStatus } from '@prisma/client';
import { TargetMode } from './pilotage-validation';

export interface CampaignReturnsSummary {
  id: string;
  name: string;
  code: string;
  collectionType: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  referenceYear: number | null;
  referenceQuarter: number | null;
}

export interface ReturnMetrics {
  quota: number | null;
  received: number;
  approved: number;
  onTime: number;
  late: number;
  gap: number | null;
  quotaRate: number | null;
  onTimeRate: number | null;
  registeredStock: number;
  responseRate: number | null;
}

export interface DepartmentReturnRow extends ReturnMetrics {
  departmentId: string;
  name: string;
}

export interface RegionReturnRow extends ReturnMetrics {
  regionId: string;
  name: string;
  mode: TargetMode;
  departments: DepartmentReturnRow[];
}

export interface CampaignReturnsResponse {
  campaign: CampaignReturnsSummary;
  central: ReturnMetrics | null;
  unassigned: ReturnMetrics | null;
  regions: RegionReturnRow[];
  totals: ReturnMetrics;
}

export function isReceivedStatus(status: OnefopStatus): boolean {
  return (
    status === OnefopStatus.PENDING_REVIEW ||
    status === OnefopStatus.APPROVED ||
    status === OnefopStatus.CORRECTION_REQUESTED
  );
}

export function isApprovedStatus(status: OnefopStatus): boolean {
  return status === OnefopStatus.APPROVED;
}

export function emptyMetrics(): ReturnMetrics {
  return {
    quota: null,
    received: 0,
    approved: 0,
    onTime: 0,
    late: 0,
    gap: null,
    quotaRate: null,
    onTimeRate: null,
    registeredStock: 0,
    responseRate: null,
  };
}

export function buildMetrics(
  quota: number | null,
  counts: {
    received: number;
    approved: number;
    onTime: number;
    late: number;
  },
  registeredStock: number,
): ReturnMetrics {
  const gap = quota !== null ? Math.max(0, quota - counts.received) : null;
  const quotaRate = quota !== null && quota > 0 ? counts.received / quota : null;
  const onTimeRate = quota !== null && quota > 0 ? counts.onTime / quota : null;
  const responseRate = registeredStock > 0 ? counts.received / registeredStock : null;

  return {
    quota,
    received: counts.received,
    approved: counts.approved,
    onTime: counts.onTime,
    late: counts.late,
    gap,
    quotaRate,
    onTimeRate,
    registeredStock,
    responseRate,
  };
}

export function addMetrics(a: ReturnMetrics, b: ReturnMetrics): ReturnMetrics {
  const combinedQuota =
    a.quota !== null || b.quota !== null
      ? (a.quota ?? 0) + (b.quota ?? 0)
      : null;
  const received = a.received + b.received;
  const approved = a.approved + b.approved;
  const onTime = a.onTime + b.onTime;
  const late = a.late + b.late;
  const registeredStock = a.registeredStock + b.registeredStock;

  return buildMetrics(
    combinedQuota,
    { received, approved, onTime, late },
    registeredStock,
  );
}

/**
 * Where a registered establishment that has not declared stands with its
 * file for the campaign: none at all, a draft started, or a file rejected.
 * A SUPERSEDED file was replaced by a newer one and says nothing on its own.
 */
export type NonRespondentFileState = 'NONE' | 'DRAFT' | 'REJECTED';

export interface NonRespondentRow {
  companyId: string;
  name: string;
  establishmentId: string;
  entityType: OnefopEntityType | null;
  /** The returns bucket the establishment counts in: classifyBucket's kind. */
  bucket: 'department' | 'central' | 'unassigned' | 'nullEntityType';
  regionId: string | null;
  regionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  fileState: NonRespondentFileState;
}

export interface CampaignNonRespondentsResponse {
  campaign: CampaignReturnsSummary;
  /**
   * The campaign's latest reminder send. Reminders are recorded per send,
   * not per establishment, so this is campaign-wide.
   */
  lastReminder: { sentAt: string; reminderType: string; recipientCount: number } | null;
  /** Registered establishments in the caller's territory. */
  registered: number;
  establishments: NonRespondentRow[];
}

/**
 * The file state of a company that has no received file, from its files for
 * the campaign: the latest one that is not SUPERSEDED decides.
 */
export function nonRespondentFileState(
  files: Array<{ status: OnefopStatus; createdAt: Date }>,
): NonRespondentFileState {
  const latest = files
    .filter((file) => file.status !== OnefopStatus.SUPERSEDED)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latest) return 'NONE';
  if (latest.status === OnefopStatus.DRAFT) return 'DRAFT';
  if (latest.status === OnefopStatus.REJECTED) return 'REJECTED';
  return 'NONE';
}
