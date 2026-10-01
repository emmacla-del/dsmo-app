import { apiFetch, ApiError } from "./api-client";
import type { UserRole } from "./user-types";

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;
/** PostgreSQL INTEGER. Matches the T.1 API cap. */
export const TARGET_MAX = 2_147_483_647;

export const PILOTAGE_WRITE_ROLES: UserRole[] = [
  "CENTRAL",
  "SUPER_ADMIN",
  "SUPER_ADMIN_ONEFOP",
];

export const PILOTAGE_READ_ROLES: UserRole[] = [
  ...PILOTAGE_WRITE_ROLES,
  "REGIONAL",
  "DIVISIONAL",
];

/** Same set as GET /campaigns (@Roles on campaign.controller.ts). */
export const CAMPAIGN_LIST_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SUPER_ADMIN_DSMO",
  "SUPER_ADMIN_ONEFOP",
  "CENTRAL",
  "REGIONAL",
];

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

export interface InscriptionTargetsResponse {
  year: number;
  central: { inscriptionTarget: number } | null;
  regions: TargetRegionRow[];
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

export interface TargetPutEntry {
  regionId: string;
  departmentId: string | null;
  inscriptionTarget?: number;
  submissionTarget?: number;
}

export interface TargetPutBody {
  entries: TargetPutEntry[];
  central?: { inscriptionTarget?: number; submissionTarget?: number } | null;
}

export interface StockCounts {
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
  return !!role && PILOTAGE_WRITE_ROLES.includes(role);
}

export function canListCampaigns(role: UserRole | undefined): boolean {
  return !!role && CAMPAIGN_LIST_ROLES.includes(role);
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

export function getInscriptionTargets(year: number) {
  return apiFetch<InscriptionTargetsResponse>(
    `/admin/pilotage/targets/inscriptions?year=${encodeURIComponent(String(year))}`,
  );
}

export function putInscriptionTargets(year: number, body: TargetPutBody) {
  return apiFetch<InscriptionTargetsResponse>(
    `/admin/pilotage/targets/inscriptions?year=${encodeURIComponent(String(year))}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
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
