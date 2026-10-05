import { apiFetch, ApiError } from "./api-client";
import type { UserRole } from "./roles";
import { CAMPAIGN_ROLES, NATIONAL_ROLES, hasRole } from "./roles";

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;
/** PostgreSQL INTEGER. Matches the T.1 API cap. */
export const TARGET_MAX = 2_147_483_647;

export type TargetMode = "UNSET" | "DEPARTMENT" | "REGION" | "MIXED";
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

export interface TargetPutEntry {
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
  inscriptionTarget: number | null;
  rate: number | null;
  departments: CoverageDepartmentRow[];
}

export interface CoverageBucket extends StockCounts {
  inscriptionTarget?: number | null;
  rate?: number | null;
}

export interface CoverageResponse {
  year: number;
  central: CoverageBucket | null;
  unassigned: StockCounts | null;
  nullEntityType: StockCounts | null;
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

export function formatApiError(error: unknown): string {
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
  return "La requête a échoué.";
}

export function getCoverage(year: number) {
  return apiFetch<CoverageResponse>(
    `/admin/pilotage/coverage?year=${encodeURIComponent(String(year))}`,
  );
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
