// The body of every ONEFOP export request from /admin/diffusion
// (POST /data-management/export/submissions/{spss/sav,spss/csv,spss/manifest,excel}).
//
// Two server rules shape it (src/data-management/spss/export-filters.ts):
//  - no `statuses` means the official statistical base, APPROVED only — so
//    "all statuses" must list them, or it silently exports approved records;
//  - an SPSS file holds one questionnaire: the employer one (entities 1–6,
//    partition DEMAND, the default) or the training-centre one (TVET). A
//    training-centre export therefore names the type VOCATIONAL_TRAINING,
//    which every format (SPSS and Excel) honours.
// Files with an open blocking anomaly stay excluded whatever is sent.

export type ExportQuestionnaire = "DEMAND" | "TVET";
export type ExportStatusChoice = "APPROVED" | "ALL" | "PENDING_REVIEW" | "REJECTED";

export const EXPORT_QUESTIONNAIRES: ExportQuestionnaire[] = ["DEMAND", "TVET"];

/** The employer types of the DEMAND questionnaire, in the filter's order. */
export const DEMAND_ENTITY_TYPES = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "ADMINISTRATION", "PROJECT_PROGRAM"];
export const TVET_ENTITY_TYPE = "VOCATIONAL_TRAINING";

/** Every administrative status a submitted file can have (drafts are never exported). */
export const ALL_EXPORT_STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUESTED"];

export interface ExportSelection {
  questionnaire: ExportQuestionnaire;
  status: ExportStatusChoice;
  /** "Toutes" or "" for the whole territory. */
  region?: string;
  department?: string;
  /** An employer type of the DEMAND questionnaire, or "" for all of them. */
  entityType?: string;
  campaign?: string | null;
  campaignId?: string | null;
}

export function buildExportFilters(sel: ExportSelection): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (sel.region && sel.region !== "Toutes") filters.region = sel.region;
  if (sel.department) filters.department = sel.department;
  if (sel.questionnaire === "TVET") {
    filters.entityType = TVET_ENTITY_TYPE;
  } else {
    filters.partition = "DEMAND";
    if (sel.entityType && DEMAND_ENTITY_TYPES.includes(sel.entityType)) filters.entityType = sel.entityType;
  }
  // campaignId is the one the export actually filters on
  // (buildOnefopExportWhere); `campaign` is kept alongside it because it
  // carries the human-readable code that formatExportScope renders in the
  // export history. Sending only the id would show a UUID there.
  if (sel.campaign) filters.campaign = sel.campaign;
  if (sel.campaignId) filters.campaignId = sel.campaignId;
  filters.statuses = sel.status === "ALL" ? [...ALL_EXPORT_STATUSES] : [sel.status];
  return filters;
}

/**
 * The questionnaire the page opens on, until the user picks one: the one with
 * more files in the register (training centres against the six employer
 * types). It was always the employer one, while every file was a training
 * centre's (defect 5, 2026-10-16). Employers on a tie, and while counts load.
 */
export function defaultQuestionnaire(byFormType: Record<string, number> | null | undefined): ExportQuestionnaire {
  if (!byFormType) return "DEMAND";
  const tvet = byFormType[TVET_ENTITY_TYPE] ?? 0;
  const demand = DEMAND_ENTITY_TYPES.reduce((sum, type) => sum + (byFormType[type] ?? 0), 0);
  return tvet > demand ? "TVET" : "DEMAND";
}

export interface RepositoryCounts {
  /** The four submitted statuses added up; null when the breakdown is missing. */
  total: number | null;
  approved: number | null;
  pending: number | null;
  correction: number | null;
  rejected: number | null;
}

/**
 * The page's key figures from GET /data-management/stats `onefopByStatus`.
 * The total is the sum of the four submitted statuses, so the figures add up
 * and drafts stay out, as the total's hint says. It was the stats total
 * (drafts included) beside three of the four statuses: "returned for
 * correction" was missing.
 */
export function repositoryCounts(
  byStatus: Record<string, number> | { status: string; _count: number }[] | null | undefined,
): RepositoryCounts {
  if (!byStatus) return { total: null, approved: null, pending: null, correction: null, rejected: null };
  // The endpoint returns a map; an older shape was the raw groupBy rows.
  const map: Record<string, number> = Array.isArray(byStatus)
    ? Object.fromEntries(byStatus.map((row) => [row.status, row._count]))
    : byStatus;
  const n = (status: string) => map[status] ?? 0;
  const approved = n("APPROVED");
  const pending = n("PENDING_REVIEW");
  const correction = n("CORRECTION_REQUESTED");
  const rejected = n("REJECTED");
  return { total: approved + pending + correction + rejected, approved, pending, correction, rejected };
}

/** The file names of one CSV export and the .sps that opens it. */
export function csvExportNames(base: string): { csv: string; sps: string } {
  return { csv: `${base}.csv`, sps: `${base}.sps` };
}
