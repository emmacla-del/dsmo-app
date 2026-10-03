import { OnefopEntityType, OnefopStatus } from '@prisma/client';
import { Territory, territoryWhere } from '../auth/territory';

/**
 * Filters of the admin dossier list. The single source of the list's Prisma
 * `where`: the page, its `total`, and any export of the list must all be built
 * from buildAdminListWhere so they can never select different rows.
 */
export interface AdminListFilters {
  status?: string;
  region?: string;
  search?: string;
  formType?: string;
  period?: AdminListPeriod;
  companyId?: string;
}

export const ADMIN_LIST_PERIODS = ['7d', '30d', '3m', '12m'] as const;
export type AdminListPeriod = (typeof ADMIN_LIST_PERIODS)[number];

/** Statuses an admin may filter on: every status except DRAFT (never listed). */
export const ADMIN_LIST_STATUSES: string[] = Object.values(OnefopStatus).filter((s) => s !== OnefopStatus.DRAFT);

/** Questionnaire types an admin may filter on (the deprecated value is excluded). */
export const ADMIN_LIST_FORM_TYPES: string[] = Object.values(OnefopEntityType).filter(
  (t) => t !== 'VOCATIONAL_TRAINING_CENTER',
);

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
 * it. Drafts are respondents' unsubmitted work and are never part of the list.
 */
export function buildAdminListWhere(
  filters: AdminListFilters,
  territory?: Territory,
  now: Date = new Date(),
): { AND: Record<string, unknown>[] } {
  const and: Record<string, unknown>[] = [territoryWhere(territory), { status: { not: OnefopStatus.DRAFT } }];
  if (filters.status) and.push({ status: filters.status });
  if (filters.formType) and.push({ formType: filters.formType });
  if (filters.companyId) and.push({ companyId: filters.companyId });
  if (filters.region) and.push({ region: { equals: filters.region, mode: 'insensitive' } });
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
