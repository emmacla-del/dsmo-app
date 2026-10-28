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
  pendingReview: number;
  correctionRequested: number;
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
  /**
   * `totals` split by entity type: the rows add up to `totals.received` and
   * `totals.registeredStock`, over the same territory scope.
   */
  byEntityType: EntityTypeReturnRow[];
  /**
   * Registered companies in scope with no entity type. Outside `totals` and
   * `byEntityType`, as they always were; reported so the gap is visible.
   */
  untypedRegisteredStock: number;
}

/**
 * GET /admin/pilotage/campaigns/:id/returns/timeline: cumulative declarations
 * received per Cameroon calendar day (Africa/Douala). Counted exactly as
 * `totals.received` of /returns (same countedReturns, same visible buckets).
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

export interface CampaignReturnsActivityDay {
  /** YYYY-MM-DD, the Douala calendar day. */
  date: string;
  submitted: number;
  approved: number;
  correctionRequested: number;
}

export interface CampaignReturnsActivity {
  campaign: CampaignReturnsSummary;
  timeZone: string;
  days: CampaignReturnsActivityDay[];
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
    pendingReview: 0,
    correctionRequested: 0,
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
    pendingReview?: number;
    correctionRequested?: number;
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
    pendingReview: counts.pendingReview ?? 0,
    correctionRequested: counts.correctionRequested ?? 0,
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
  const pendingReview = a.pendingReview + b.pendingReview;
  const correctionRequested = a.correctionRequested + b.correctionRequested;
  const onTime = a.onTime + b.onTime;
  const late = a.late + b.late;
  const registeredStock = a.registeredStock + b.registeredStock;

  return buildMetrics(
    combinedQuota,
    { received, approved, pendingReview, correctionRequested, onTime, late },
    registeredStock,
  );
}

/**
 * One row of the breakdown by entity type: the same returns and stock as the
 * headline, split by the kind of organisation instead of by territory. No
 * quota fields — quotas are set per territory, never per type.
 */
export interface EntityTypeReturnRow {
  entityType: string;
  received: number;
  approved: number;
  pendingReview: number;
  correctionRequested: number;
  onTime: number;
  late: number;
  registeredStock: number;
  responseRate: number | null;
}

/** The order the breakdown lists types in: the registration screen's order. */
export const ENTITY_TYPE_ORDER: readonly string[] = [
  OnefopEntityType.ENTREPRISE,
  OnefopEntityType.COOPERATIVE,
  OnefopEntityType.CTD,
  OnefopEntityType.ONG,
  OnefopEntityType.ADMINISTRATION,
  OnefopEntityType.PROJECT_PROGRAM,
  OnefopEntityType.VOCATIONAL_TRAINING,
];

interface TypeCell {
  received: number;
  approved: number;
  pendingReview: number;
  correctionRequested: number;
  onTime: number;
  late: number;
  registeredStock: number;
}

/**
 * Stock and returns tallied by (territory bucket, entity type), so the
 * breakdown can be summed over exactly the buckets the headline sums and its
 * rows add up to the headline. A registered company counts under its own
 * entityType; a return counts under the formType of the questionnaire filed,
 * the same field that routes a return to the central bucket.
 */
export class EntityTypeTally {
  private readonly cells = new Map<string, Map<string, TypeCell>>();

  addStock(bucket: string, entityType: string): void {
    this.cell(bucket, entityType).registeredStock += 1;
  }

  addReturn(bucket: string, entityType: string, status: OnefopStatus, late: boolean): void {
    const cell = this.cell(bucket, entityType);
    cell.received += 1;
    if (status === OnefopStatus.APPROVED) cell.approved += 1;
    if (status === OnefopStatus.PENDING_REVIEW) cell.pendingReview += 1;
    if (status === OnefopStatus.CORRECTION_REQUESTED) cell.correctionRequested += 1;
    if (late) cell.late += 1;
    else cell.onTime += 1;
  }

  /**
   * The breakdown over `buckets`. Every type of ENTITY_TYPE_ORDER is listed,
   * zero included — a type nobody declared is information — except
   * ADMINISTRATION outside national scope, where administrations are a
   * national cohort the headline never counts. A type outside the order (a
   * deprecated value) is listed after, only when it holds something.
   */
  rows(buckets: Iterable<string>, national: boolean): EntityTypeReturnRow[] {
    const sums = new Map<string, TypeCell>();
    for (const bucket of buckets) {
      for (const [entityType, cell] of this.cells.get(bucket) ?? []) {
        const sum = sums.get(entityType) ?? emptyCell();
        sum.received += cell.received;
        sum.approved += cell.approved;
        sum.pendingReview += cell.pendingReview;
        sum.correctionRequested += cell.correctionRequested;
        sum.onTime += cell.onTime;
        sum.late += cell.late;
        sum.registeredStock += cell.registeredStock;
        sums.set(entityType, sum);
      }
    }
    const listed = ENTITY_TYPE_ORDER.filter(
      (entityType) => national || entityType !== OnefopEntityType.ADMINISTRATION,
    );
    const extra = [...sums.keys()]
      .filter((entityType) => !ENTITY_TYPE_ORDER.includes(entityType))
      .sort();
    return [...listed, ...extra].map((entityType) => {
      const cell = sums.get(entityType) ?? emptyCell();
      return {
        entityType,
        ...cell,
        responseRate: cell.registeredStock > 0 ? cell.received / cell.registeredStock : null,
      };
    });
  }

  private cell(bucket: string, entityType: string): TypeCell {
    const byType = this.cells.get(bucket) ?? new Map<string, TypeCell>();
    this.cells.set(bucket, byType);
    const cell = byType.get(entityType) ?? emptyCell();
    byType.set(entityType, cell);
    return cell;
  }
}

function emptyCell(): TypeCell {
  return { received: 0, approved: 0, pendingReview: 0, correctionRequested: 0, onTime: 0, late: 0, registeredStock: 0 };
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
  /** Linked company account email, only for roles allowed to contact the establishment. */
  contactEmail?: string;
  /** Primary respondent or establishment phone, only for roles allowed to contact the establishment. */
  contactPhone?: string;
  latestFollowUp?: CampaignFollowUpSummary | null;
  fileState: NonRespondentFileState;
}

export interface CampaignFollowUpSummary {
  channel: string;
  outcome: string;
  messageLanguage: string | null;
  createdAt: string;
  actorName: string;
  actorTitle: string | null;
}

export interface CampaignNonRespondentsResponse {
  campaign: CampaignReturnsSummary & { deadline: string | null };
  /**
   * The campaign's latest reminder send. Reminders are recorded per send,
   * not per establishment, so this is campaign-wide.
   */
  lastReminder: { sentAt: string; reminderType: string; recipientCount: number } | null;
  /** Registered establishments in the caller's territory. */
  registered: number;
  establishments: NonRespondentRow[];
}

export interface RecordCampaignFollowUpInput {
  channel: "WHATSAPP" | "PHONE" | "EMAIL";
  outcome:
    | "SENT_CONFIRMED"
    | "NO_ANSWER"
    | "WRONG_NUMBER"
    | "CALLBACK_REQUESTED"
    | "ALREADY_SUBMITTED"
    | "DO_NOT_CONTACT";
  messageLanguage?: "fr" | "en";
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
