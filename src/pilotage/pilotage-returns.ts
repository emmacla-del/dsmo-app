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
 * One row of the breakdown by entity type: the same returns and stock as the
 * headline, split by the kind of organisation instead of by territory. No
 * quota fields — quotas are set per territory, never per type.
 */
export interface EntityTypeReturnRow {
  entityType: string;
  received: number;
  approved: number;
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

  addReturn(bucket: string, entityType: string, approved: boolean, late: boolean): void {
    const cell = this.cell(bucket, entityType);
    cell.received += 1;
    if (approved) cell.approved += 1;
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
  return { received: 0, approved: 0, onTime: 0, late: 0, registeredStock: 0 };
}
