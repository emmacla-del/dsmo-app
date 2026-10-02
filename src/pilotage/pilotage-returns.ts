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
