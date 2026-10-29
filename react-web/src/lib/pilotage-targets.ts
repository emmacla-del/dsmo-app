import { apiFetch, ApiError } from "./api-client";
import type { UserRole } from "./roles";
import { CAMPAIGN_ROLES, NATIONAL_ROLES, hasRole } from "./roles";
import type { UiLocale } from "./register-i18n";
import type { Campaign } from "./campaigns";

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;
/** PostgreSQL INTEGER. Matches the T.1 API cap. */
export const TARGET_MAX = 2_147_483_647;

/**
 * How a region's quota is set. ENTITY_TYPE joined the union on 2026-10-25
 * with the region x type grain: one region-level row per entity type, summed,
 * because the types partition the register. A region in two of these at once
 * is MIXED and carries no target.
 */
export type TargetMode = "UNSET" | "DEPARTMENT" | "REGION" | "ENTITY_TYPE" | "MIXED";
export type TargetField = "inscriptionTarget" | "submissionTarget";

export interface TargetDepartmentRow {
  departmentId: string;
  name: string;
  inscriptionTarget?: number | null;
  submissionTarget?: number | null;
}

export interface TargetRegionRow {
  regionId: string;
  name: string;
  mode: TargetMode;
  inscriptionTarget?: number | null;
  submissionTarget?: number | null;
  departments: TargetDepartmentRow[];
  /**
   * Quota per entity type, keyed by OnefopEntityType code. Empty unless the
   * region is in ENTITY_TYPE mode; absent from a backend older than
   * 2026-10-25, which the editor reads as "none set".
   */
  byEntityType?: Record<string, number>;
}

export interface CampaignQuotaSummary {
  id: string;
  name: string;
  code: string;
  collectionType: string;
  status: string;
}

export interface CampaignQuotasResponse {
  campaign: CampaignQuotaSummary;
  central: { submissionTarget: number } | null;
  regions: TargetRegionRow[];
}

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
   * `totals` split by entity type; the rows add up to it. Optional: a backend
   * older than 2026-10-17 does not send it.
   */
  byEntityType?: EntityTypeReturnRow[];
  /** Registered establishments in scope with no entity type, outside `totals`. */
  untypedRegisteredStock?: number;
}

export interface EntityTypeReturnRow {
  /** An OnefopEntityType code, e.g. "VOCATIONAL_TRAINING". */
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

/** Where a registered establishment that has not declared stands with its file. */
export type NonRespondentFileState = "NONE" | "DRAFT" | "REJECTED";
export type NonRespondentBucket = "department" | "central" | "unassigned" | "nullEntityType";
export type CampaignFollowUpChannel = "WHATSAPP" | "PHONE" | "EMAIL";
export type CampaignFollowUpOutcome =
  | "SENT_CONFIRMED"
  | "NO_ANSWER"
  | "WRONG_NUMBER"
  | "CALLBACK_REQUESTED"
  | "ALREADY_SUBMITTED"
  | "DO_NOT_CONTACT";

export interface CampaignFollowUpSummary {
  channel: CampaignFollowUpChannel;
  outcome: CampaignFollowUpOutcome;
  messageLanguage: "fr" | "en" | null;
  createdAt: string;
  actorName: string;
  actorTitle: string | null;
}

export interface RecordCampaignFollowUpInput {
  channel: CampaignFollowUpChannel;
  outcome: CampaignFollowUpOutcome;
  messageLanguage?: "fr" | "en";
}

export interface NonRespondentRow {
  companyId: string;
  name: string;
  establishmentId: string;
  entityType: string | null;
  bucket: NonRespondentBucket;
  regionId: string | null;
  regionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  /** Linked company account email; omitted for roles without contact access. */
  contactEmail?: string;
  /** Registered respondent's name; omitted for roles without contact access. */
  contactName?: string;
  /** Registered respondent's function; omitted for roles without contact access. */
  contactFunction?: string;
  contactPhone?: string;
  latestFollowUp?: CampaignFollowUpSummary | null;
  fileState: NonRespondentFileState;
}

export interface CampaignNonRespondentsResponse {
  campaign: CampaignReturnsSummary & { deadline: string | null };
  /** Campaign-wide: reminders are not recorded per establishment. */
  lastReminder: { sentAt: string; reminderType: string; recipientCount: number } | null;
  registered: number;
  establishments: NonRespondentRow[];
}

export interface NonRespondentGroup {
  key: string;
  bucket: NonRespondentBucket;
  regionName: string | null;
  departmentName: string | null;
  rows: NonRespondentRow[];
}

const OUT_OF_TERRITORY_ORDER: NonRespondentBucket[] = ["central", "unassigned", "nullEntityType"];

/**
 * One group per department, in the server's order (region, department,
 * name), then the establishments that belong to no department: central
 * administrations, unassigned ones, and those without an entity type.
 */
export function groupNonRespondents(rows: NonRespondentRow[]): NonRespondentGroup[] {
  const groups = new Map<string, NonRespondentGroup>();
  for (const row of rows) {
    const key = row.bucket === "department" ? `d:${row.regionId}:${row.departmentId}` : row.bucket;
    const group = groups.get(key) ?? {
      key,
      bucket: row.bucket,
      regionName: row.bucket === "department" ? row.regionName : null,
      departmentName: row.bucket === "department" ? row.departmentName : null,
      rows: [],
    };
    group.rows.push(row);
    groups.set(key, group);
  }
  const all = [...groups.values()];
  return [
    ...all.filter((group) => group.bucket === "department"),
    ...OUT_OF_TERRITORY_ORDER.flatMap((bucket) => all.filter((group) => group.bucket === bucket)),
  ];
}

export function nonRespondentsHref(campaignId: string): string {
  return `/admin/cibles?vue=relances&campagne=${encodeURIComponent(campaignId)}`;
}

export interface TargetPutEntry {
  /**
   * The entity type this quota is for, or null/absent for every type.
   * Region level only: the server refuses a type on a department row.
   */
  entityType?: string | null;
  regionId: string;
  departmentId?: string | null;
  inscriptionTarget?: number;
  submissionTarget?: number;
  clear?: boolean;
}

export interface TargetPutBody {
  entries: TargetPutEntry[];
  central?: { inscriptionTarget?: number; submissionTarget?: number } | null;
}

export interface StockCounts {
  /**
   * Every Company row in the territory, whatever its status. `registered` and
   * the pending counts are measurements over those rows, so companyCount === 0
   * means there is nothing to measure — distinct from a measured zero.
   */
  companyCount: number;
  registered: number;
  registeredInYear: number;
  pendingApproval: number;
  pendingReview: number;
  complementsRequested: number;
  documentsIncomplete: number;
  draft: number;
  overdue: number;
}

export interface CoverageDepartmentRow extends StockCounts {
  departmentId: string;
  name: string;
  inscriptionTarget: number | null;
  rate: number | null;
}

export interface CoverageRegionRow {
  regionId: string;
  name: string;
  mode: TargetMode;
  /** null when the reader's scope hides region-level stock. */
  companyCount: number | null;
  registered: number | null;
  registeredInYear: number | null;
  pendingApproval: number | null;
  pendingReview: number | null;
  complementsRequested: number | null;
  documentsIncomplete: number | null;
  draft: number | null;
  overdue: number | null;
  inscriptionTarget: number | null;
  rate: number | null;
  departments: CoverageDepartmentRow[];
}

export interface CoverageBucket extends StockCounts {
  inscriptionTarget?: number | null;
  rate?: number | null;
}

/**
 * Registration stock for one entity type, over the reader's own territory
 * scope. There is no quota-attainment rate because quotas are territorial
 * (scopeKind TERRITORIAL / ADMINISTRATION); the UI derives registered share
 * from registered / companyCount.
 */
export interface CoverageEntityTypeRow extends StockCounts {
  /** An OnefopEntityType code, e.g. "VOCATIONAL_TRAINING". */
  entityType: string;
  /**
   * The type's quota over the reader's scope: the sum of the region-level
   * per-type rows, or for ADMINISTRATION the national cohort row. Null when
   * nobody set one, which is not a target of zero. Absent from a backend
   * older than 2026-10-25.
   */
  inscriptionTarget?: number | null;
  /** registeredInYear / inscriptionTarget, 0-1; null without a quota. */
  rate?: number | null;
}

export interface CoverageTotals extends StockCounts {
  /**
   * Null when no total can be stated: a MIXED region in scope has no
   * determinate quota, so neither has the grid. `targetIndeterminate` says
   * that is the reason, as opposed to a scope with no quota at all.
   */
  inscriptionTarget: number | null;
  rate: number | null;
  targetIndeterminate?: boolean;
}

export interface CoverageResponse {
  year: number;
  overdueDays: number;
  // The server echoes the selected annual or semester period and its source
  // campaigns. A null semester indicates the annual fold.
  period: {
    year: number;
    quarter: number | null;
    semester: number | null;
    campaignIds: string[];
  };
  totals: CoverageTotals;
  central: CoverageBucket | null;
  unassigned: StockCounts | null;
  nullEntityType: StockCounts | null;
  /**
   * The same stock split by entity type, listed on the same terms as
   * CampaignReturnsResponse.byEntityType. Optional: a backend older than
   * 2026-10-24 does not send it.
   */
  byEntityType?: CoverageEntityTypeRow[];
  regions: CoverageRegionRow[];
}

export function canWritePilotageTargets(role: UserRole | undefined): boolean {
  return hasRole(role, NATIONAL_ROLES);
}

export function canListCampaigns(role: UserRole | undefined): boolean {
  return hasRole(role, CAMPAIGN_ROLES);
}

/** Africa/Douala is UTC+1 with no DST. */
export function doualaCalendarYear(now = new Date()): number {
  return new Date(now.getTime() + 60 * 60 * 1000).getUTCFullYear();
}

export function parseYearParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  if (!/^\d+$/.test(raw.trim())) return null;
  const year = Number(raw.trim());
  if (year < YEAR_MIN || year > YEAR_MAX) return null;
  return year;
}

/** Build the canonical campaign-targets handoff for registration coverage. */
export function coverageHref(
  annee: string | number | null,
  semestre?: string | null,
  trimestre?: string | null,
): string {
  const year = typeof annee === "number" ? parseYearParam(String(annee)) : parseYearParam(annee);
  const requestedSemester = semestre === "1" || semestre === "2" ? Number(semestre) as 1 | 2 : null;
  const requestedQuarter = ["1", "2", "3", "4"].includes(trimestre ?? "")
    ? Number(trimestre) as 1 | 2 | 3 | 4
    : null;
  const semester: 1 | 2 | null = requestedQuarter != null
    ? requestedSemester ?? (requestedQuarter <= 2 ? 1 : 2)
    : requestedSemester;
  const quarter = requestedQuarter != null && semester === (requestedQuarter <= 2 ? 1 : 2)
    ? requestedQuarter
    : null;

  const params = new URLSearchParams({ vue: "couverture" });
  if (year != null) params.set("annee", String(year));
  if (semester != null) params.set("semestre", String(semester));
  if (quarter != null) params.set("trimestre", String(quarter));
  return `/admin/cibles?${params.toString()}`;
}

export function formatApiError(error: unknown, locale: UiLocale = "fr"): string {
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const msg = (body as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
      if (Array.isArray(msg) && msg.length > 0) return msg.map(String).join(" ");
    }
    if (typeof error.message === "string" && error.message.trim()) return error.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return locale === "en" ? "The request failed." : "La requête a échoué.";
}

/**
 * The ACTIVE collection campaigns, for every pilotage reader: unlike
 * GET /campaigns, open to DIVISIONAL_ADMIN and CENTRAL_AGENT (§21, 2026-10-17).
 * Metadata only; `deadline` is the one in force (extended when it was).
 */
export type PilotageCampaign = Pick<
  Campaign,
  "id" | "code" | "name" | "status" | "periodicity" | "collectionType" | "startDate" | "deadline"
>;

export function getActiveCollectionCampaigns() {
  return apiFetch<PilotageCampaign[]>("/admin/pilotage/campaigns/active");
}

export function getAnnualCoverage(year: number) {
  return apiFetch<CoverageResponse>(
    `/admin/pilotage/coverage/annual?year=${encodeURIComponent(String(year))}`,
  );
}

export function getSemesterCoverage(year: number, semester: 1 | 2) {
  const params = new URLSearchParams({ year: String(year), semester: String(semester) });
  return apiFetch<CoverageResponse>(`/admin/pilotage/coverage/semester?${params.toString()}`);
}

export function getQuarterCoverage(year: number, quarter: 1 | 2 | 3 | 4) {
  const params = new URLSearchParams({ year: String(year), quarter: String(quarter) });
  return apiFetch<CoverageResponse>(`/admin/pilotage/coverage/quarter?${params.toString()}`);
}

export function getCampaignQuotas(campaignId: string) {
  return apiFetch<CampaignQuotasResponse>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/quotas`,
  );
}

export function putCampaignQuotas(campaignId: string, body: TargetPutBody) {
  return apiFetch<CampaignQuotasResponse>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/quotas`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function getCampaignReturns(campaignId: string) {
  return apiFetch<CampaignReturnsResponse>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/returns`,
  );
}

export function getCampaignNonRespondents(campaignId: string) {
  return apiFetch<CampaignNonRespondentsResponse>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/non-respondents`,
  );
}

export function recordCampaignFollowUp(
  campaignId: string,
  companyId: string,
  body: RecordCampaignFollowUpInput,
) {
  return apiFetch<CampaignFollowUpSummary>(
    `/admin/pilotage/campaigns/${encodeURIComponent(campaignId)}/non-respondents/${encodeURIComponent(companyId)}/follow-ups`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
