import { OnefopEntityType, OnefopStatus } from '@prisma/client';
import { bucketKey } from './pilotage-coverage';
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

/**
 * GET /admin/pilotage/campaigns/:id/returns/timeline: cumulative declarations
 * received per Cameroon calendar day (Africa/Douala). Counted exactly as
 * `totals.received` of /returns (same countedReturns, same visible buckets),
 * so the last day's `cumulative` equals that headline total.
 */
export interface CampaignReturnsTimelineDay {
  /** YYYY-MM-DD, the Douala calendar day. */
  date: string;
  received: number;
  cumulative: number;
}

export interface CampaignReturnsTimeline {
  campaign: CampaignReturnsSummary & {
    deadline: string | null;
    extendedDeadline: string | null;
  };
  timeZone: string;
  total: number;
  days: CampaignReturnsTimelineDay[];
}

/** The submission columns the returns read. */
export interface ReturnSubmissionRow {
  id: string;
  companyId: string | null;
  formType: OnefopEntityType | string;
  status: OnefopStatus;
  isLate: boolean;
  regionId: string | null;
  departmentId: string | null;
  submissionDate: Date;
  createdAt: Date;
}

export interface CountedReturn {
  /** The file that decides approved/late: the latest received one. */
  submission: ReturnSubmissionRow;
  /** 'central', 'unassigned' or a department bucketKey. */
  bucket: string;
  /**
   * When the establishment first delivered a file that was not rejected:
   * the earliest submissionDate among its received and SUPERSEDED files.
   * A correction answered later does not move it (owner, 2026-10-17).
   */
  firstReceivedAt: Date;
}

/**
 * The one definition of "received" for a campaign's returns: one entry per
 * establishment (resubmissions count once) whose latest file that is not a
 * draft or rejected is received (PENDING_REVIEW, APPROVED,
 * CORRECTION_REQUESTED). An establishment whose files are all drafts,
 * rejected, or replaced counts nowhere.
 */
export function countedReturns(submissions: readonly ReturnSubmissionRow[]): CountedReturn[] {
  // Latest first, as the original query's orderBy; sorted here so the rule
  // does not depend on the caller's ordering.
  const ordered = [...submissions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const byCompany = new Map<string, ReturnSubmissionRow[]>();
  for (const sub of ordered) {
    const key = sub.companyId ?? `sub-${sub.id}`;
    const list = byCompany.get(key) ?? [];
    list.push(sub);
    byCompany.set(key, list);
  }

  const counted: CountedReturn[] = [];
  for (const [, companySubs] of byCompany) {
    const receivedSub = companySubs.find((s) => isReceivedStatus(s.status));
    if (!receivedSub) continue;

    let firstReceivedAt = receivedSub.submissionDate;
    for (const s of companySubs) {
      if (
        (isReceivedStatus(s.status) || s.status === OnefopStatus.SUPERSEDED) &&
        s.submissionDate &&
        s.submissionDate.getTime() < firstReceivedAt.getTime()
      ) {
        firstReceivedAt = s.submissionDate;
      }
    }

    let bucket: string;
    if (receivedSub.formType === OnefopEntityType.ADMINISTRATION) bucket = 'central';
    else if (!receivedSub.regionId || !receivedSub.departmentId) bucket = 'unassigned';
    else {
      bucket = bucketKey({
        kind: 'department',
        regionId: receivedSub.regionId,
        departmentId: receivedSub.departmentId,
      });
    }
    counted.push({ submission: receivedSub, bucket, firstReceivedAt });
  }
  return counted;
}

const DOUALA_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Douala',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Africa/Douala calendar day of an instant, as YYYY-MM-DD. */
export function doualaDay(value: Date): string {
  return DOUALA_DAY.format(value);
}

function nextDay(day: string): string {
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * Daily cumulative series. Days run from the campaign start (or the first
 * delivery, if earlier) to today, stopped at the collection's last day (the
 * latest of endDate and the effective deadline) once that has passed, and
 * never before the last delivery. Days with nothing received are kept.
 */
export function buildTimelineDays(
  deliveries: readonly Date[],
  bounds: { startDate: Date | null; lastDay: Date | null; now: Date },
): CampaignReturnsTimelineDay[] {
  const perDay = new Map<string, number>();
  for (const at of deliveries) {
    const day = doualaDay(at);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const deliveryDays = [...perDay.keys()].sort();

  const candidatesStart = [
    ...(bounds.startDate ? [doualaDay(bounds.startDate)] : []),
    ...deliveryDays.slice(0, 1),
  ].sort();
  if (candidatesStart.length === 0) return [];
  const first = candidatesStart[0];

  const today = doualaDay(bounds.now);
  let last = bounds.lastDay && doualaDay(bounds.lastDay) < today ? doualaDay(bounds.lastDay) : today;
  const lastDelivery = deliveryDays[deliveryDays.length - 1];
  if (lastDelivery && lastDelivery > last) last = lastDelivery;
  if (last < first) last = first;

  const days: CampaignReturnsTimelineDay[] = [];
  let cumulative = 0;
  for (let day = first; day <= last; day = nextDay(day)) {
    const received = perDay.get(day) ?? 0;
    cumulative += received;
    days.push({ date: day, received, cumulative });
  }
  return days;
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
