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
