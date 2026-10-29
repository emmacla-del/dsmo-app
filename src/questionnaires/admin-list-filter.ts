import { AnomalyStatus, OnefopEntityType, OnefopStatus } from '@prisma/client';
import { Territory, territoryWhere } from '../auth/territory';
import { archiveState } from '../common/archive-predicate';
import { reviewOverdueBefore } from './review-delay';

/**
 * Filters of the admin dossier list. The single source of the list's Prisma
 * `where`: the page, its `total`, and any export of the list must all be built
 * from buildAdminListWhere so they can never select different rows.
 */
export interface AdminListFilters {
  status?: string;
  statuses?: string[];
  region?: string;
  department?: string;
  search?: string;
  formType?: string;
  period?: AdminListPeriod;
  companyId?: string;
  /**
   * Absent means every campaign. Nothing in this builder substitutes a
   * default campaign: an empty value adds no clause.
   */
  campaignId?: string;
  quarterCode?: string;
  late?: boolean;
  overdue?: boolean;
  /** Open-anomaly reading, the same one the Contrôles column uses. */
  quality?: AdminListQuality;
  /**
   * `me` and `other` use `assigneeId` as the signed-in officer.
   * `unassigned` matches a null assignee and ignores `assigneeId`.
   */
  assignment?: AdminListAssignment;
  /** Signed-in officer when assignment is `me` or `other`, or the legacy assignedToMe path. */
  assigneeId?: string;
}

export const ADMIN_LIST_PERIODS = ['7d', '30d', '3m', '12m'] as const;
export type AdminListPeriod = (typeof ADMIN_LIST_PERIODS)[number];

/** Order of the list by submission: newest first (the default) or oldest first. */
export const ADMIN_LIST_SORTS = ['newest', 'oldest'] as const;
export type AdminListSort = (typeof ADMIN_LIST_SORTS)[number];

/** Statuses an admin may filter on: every status except DRAFT (never listed). */
export const ADMIN_LIST_STATUSES: string[] = Object.values(OnefopStatus).filter((s) => s !== OnefopStatus.DRAFT);

/** Questionnaire types an admin may filter on (the deprecated value is excluded). */
export const ADMIN_LIST_FORM_TYPES: string[] = Object.values(OnefopEntityType).filter(
  (t) => t !== 'VOCATIONAL_TRAINING_CENTER',
);

/**
 * Quality of the open anomalies, matching the Contrôles column:
 * blocking = an OPEN anomaly with isBlocking, warning = an OPEN anomaly
 * without it. RESOLVED and WAIVED rows are historical and count as neither.
 */
export const ADMIN_LIST_QUALITIES = ['clean', 'warnings', 'blocking'] as const;
export type AdminListQuality = (typeof ADMIN_LIST_QUALITIES)[number];

/** Who holds the review. `me` and `other` are relative to the signed-in officer. */
export const ADMIN_LIST_ASSIGNMENTS = ['me', 'unassigned', 'other'] as const;
export type AdminListAssignment = (typeof ADMIN_LIST_ASSIGNMENTS)[number];

/** Start of the period window, relative to `now` (calendar months for 3m/12m). */
export function periodStart(period: AdminListPeriod, now: Date): Date {
  const since = new Date(now);
  if (period === '7d') since.setDate(since.getDate() - 7);
  else if (period === '30d') since.setDate(since.getDate() - 30);
  else if (period === '3m') since.setMonth(since.getMonth() - 3);
  else since.setFullYear(since.getFullYear() - 1);
  return since;
}

/**
 * Filters are combined with AND, never spread into one object: a region filter
 * must narrow the caller's territory, never replace its region key and escape
 * it. Drafts are respondents' unsubmitted work and are never part of the list;
 * replaced files (SUPERSEDED) only when the status filter asks for them.
 * `overdue` is one more clause under the same AND, so no filter can widen the
 * caller's territory.
 */
export function buildAdminListWhere(
  filters: AdminListFilters,
  territory?: Territory,
  now: Date = new Date(),
  includeArchived = false,
): { AND: Record<string, unknown>[] } {
  // ADR-0001 / Phase 1: SUPERSEDED is excluded by default and included
  // only when explicitly requested via status=SUPERSEDED or
  // statuses=...,SUPERSEDED. vue=completed relies on deliberate inclusion;
  // never leak replaced records into the default queue or counts. See
  // docs/plans/admin-modules-phase1-contract.md C.2.
  // A file replaced by a newer submission (SUPERSEDED) is closed: out of the
  // list unless asked for by its status, as the file it points to is there.
  const explicitlyIncludesSuperseded = filters.status === OnefopStatus.SUPERSEDED
    || filters.statuses?.includes(OnefopStatus.SUPERSEDED) === true;
  const hidden = explicitlyIncludesSuperseded
    ? [OnefopStatus.DRAFT]
    : [OnefopStatus.DRAFT, OnefopStatus.SUPERSEDED];
  const and: Record<string, unknown>[] = [
    territoryWhere(territory),
    { status: { notIn: hidden } },
    archiveState(includeArchived),
  ];
  if (filters.statuses?.length) and.push({ status: { in: filters.statuses } });
  else if (filters.status) and.push({ status: filters.status });
  if (filters.formType) and.push({ formType: filters.formType });
  if (filters.companyId) and.push({ companyId: filters.companyId });
  if (filters.region) and.push({ region: { equals: filters.region, mode: 'insensitive' } });
  if (filters.department) and.push({ department: { equals: filters.department, mode: 'insensitive' } });
  // No campaignId means every campaign. There is no default round here.
  if (filters.campaignId) and.push({ campaignId: filters.campaignId });
  if (filters.quarterCode) and.push({ quarterCode: filters.quarterCode });
  if (filters.quality === 'clean') {
    and.push({ anomalies: { none: { status: AnomalyStatus.OPEN } } });
  } else if (filters.quality === 'warnings') {
    and.push({ anomalies: { some: { status: AnomalyStatus.OPEN, isBlocking: false } } });
    and.push({ anomalies: { none: { status: AnomalyStatus.OPEN, isBlocking: true } } });
  } else if (filters.quality === 'blocking') {
    and.push({ anomalies: { some: { status: AnomalyStatus.OPEN, isBlocking: true } } });
  }
  if (filters.assignment === 'unassigned') {
    and.push({ assigneeId: null });
  } else if (filters.assignment === 'me' || filters.assignment === 'other' || filters.assigneeId) {
    // No officer id cannot mean "everyone" or "everyone else": match nothing.
    if (!filters.assigneeId) and.push({ id: { in: [] } });
    else if (filters.assignment === 'other') {
      and.push({ AND: [{ assigneeId: { not: null } }, { assigneeId: { not: filters.assigneeId } }] });
    } else and.push({ assigneeId: filters.assigneeId });
  }
  if (filters.late) and.push({ isLate: true });
  // ADR-0001: OVERDUE is derived (PENDING_REVIEW + cutoff), not stored. It is
  // never valid in status/statuses; use overdue=true. See
  // docs/plans/admin-modules-phase1-contract.md C.2.
  // "Overdue" is the pilotage queue's measure, repeated here under the same
  // AND: pending files submitted before the shared threshold. Repeating the
  // status keeps the clause meaningful if a caller combines it with a status.
  if (filters.overdue) {
    and.push({
      status: OnefopStatus.PENDING_REVIEW,
      submissionDate: { lt: reviewOverdueBefore(now) },
    });
  }
  // createdAt: indexed, the list's sort key, and the same instant as the
  // "Reçu le" submissionDate (both set when the row is created).
  if (filters.period) and.push({ createdAt: { gte: periodStart(filters.period, now) } });
  if (filters.search) {
    const contains = { contains: filters.search, mode: 'insensitive' };
    and.push({
      OR: [
        { submissionId: contains },
        { respondent: { respondentName: contains } },
        { enterpriseDetail: { companyName: contains } },
        { cooperativeDetail: { cooperativeName: contains } },
        { ongDetail: { ongName: contains } },
        { administrationDetail: { name: contains } },
        { projectProgramDetail: { name: contains } },
        { vocationalTrainingDetail: { name: contains } },
      ],
    });
  }
  return { AND: and };
}
