// src/lib/anomaly-registry.ts
//
// GET /admin/questionnaires/anomalies/registry — src/questionnaires/
// admin-questionnaires.controller.ts → EligibilityEngineService.listAnomalies.
//
// Shapes read directly from the Prisma model (prisma/schema.prisma
// `model OnefopAnomaly`) and the service's `include`, not inferred from the
// UI. The previous frontend type declared `submission.companyName`, which the
// backend never returns — the real path is `submission.company.name` — so the
// company column silently fell through to a fallback on every row.
//
// Rows are territory-scoped server-side (`where.submission =
// territoryWhere(territory)`), so a REGIONAL_ADMIN or DIVISIONAL_ADMIN caller only ever
// sees anomalies inside its own ressort. `total` counts the filtered query,
// not the returned page.
//
// Rows ARE persisted. Three `onefopAnomaly.createMany` call sites write them:
// src/questionnaires/eligibility-engine.service.ts:58 (on evaluation),
// src/questionnaires/eligibility-engine.service.ts:839 (the backfill path),
// and src/questionnaires/questionnaires.service.ts:1530 (re-detection on
// resubmit, after a deleteMany of the submission's previous rows). An earlier
// comment here claimed the opposite — it was wrong, and screens should not
// treat an empty page as the expected steady state.

import { apiFetch } from "./api-client";

export type AnomalyStatus = "OPEN" | "RESOLVED" | "WAIVED";
export type AnomalySeverity = "CRITICAL" | "WARNING" | "INFO";
export type AnomalyResolutionType =
  | "DECLARANT_CORRECTION"
  | "FIELD_INSPECTION"
  | "LEGAL_DEROGATION";

export interface AnomalySubmissionRef {
  id: string;
  submissionId: string | null;
  formType: string | null;
  region: string | null;
  department: string | null;
  company: { name: string | null } | null;
}

export interface AnomalyRecord {
  id: string;
  submissionId: string;
  ruleCode: string;
  ruleFamily: string;
  severity: AnomalySeverity;
  isBlocking: boolean;
  status: AnomalyStatus;
  description: string;
  observedValue: string;
  expectedValue: string;
  deltaValue: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolutionType: AnomalyResolutionType | null;
  resolutionNote: string | null;
  evidenceUrl: string | null;
  submission: AnomalySubmissionRef | null;
  resolvedBy: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

export interface AnomalyRegistryPage {
  total: number;
  items: AnomalyRecord[];
}

export interface AnomalyRegistryParams {
  submissionId?: string;
  status?: AnomalyStatus;
  isBlocking?: boolean;
  limit?: number;
  offset?: number;
}

export function listAnomalyRegistry(params: AnomalyRegistryParams = {}) {
  const query = new URLSearchParams();
  if (params.submissionId) query.set("submissionId", params.submissionId);
  if (params.status) query.set("status", params.status);
  if (params.isBlocking !== undefined) query.set("isBlocking", String(params.isBlocking));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return apiFetch<AnomalyRegistryPage>(`/admin/questionnaires/anomalies/registry${qs ? `?${qs}` : ""}`);
}

export function resolveAnomalyRecord(
  id: string,
  payload: { resolutionType: AnomalyResolutionType; resolutionNote: string; evidenceUrl?: string },
) {
  return apiFetch<AnomalyRecord>(`/admin/questionnaires/anomalies/${encodeURIComponent(id)}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export { APPROVAL_ROLES as ANOMALY_REGISTRY_ROLES, NATIONAL_ROLES as ANOMALY_DEROGATION_ROLES } from "./roles";

/** Establishment name as actually stored, or null when the record has none. */
export function anomalyCompanyName(a: AnomalyRecord): string | null {
  return a.submission?.company?.name ?? null;
}

/** Human dossier reference: the official submissionId when present, else the row id. */
export function anomalyDossierRef(a: AnomalyRecord): string {
  return a.submission?.submissionId ?? a.submission?.id ?? a.submissionId;
}

// Plain names for the stored rule families (src/questionnaires/
// coherence-anomaly.ts, eligibility-engine.service.ts). An unknown family is
// shown as stored rather than guessed at.
const RULE_FAMILY_LABELS: Record<string, { fr: string; en: string }> = {
  COHERENCE: { fr: "Cohérence", en: "Consistency" },
  VT_COHERENCE: { fr: "Cohérence (formation professionnelle)", en: "Consistency (vocational training)" },
  ARITHMETIC: { fr: "Contrôles arithmétiques", en: "Arithmetic checks" },
};

export function ruleFamilyLabel(family: string, locale: "fr" | "en" = "fr"): string {
  return RULE_FAMILY_LABELS[family]?.[locale] ?? family;
}

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  OPEN: "Ouverte",
  RESOLVED: "Résolue",
  WAIVED: "Dérogée",
};

export const ANOMALY_RESOLUTION_LABELS: Record<AnomalyResolutionType, string> = {
  DECLARANT_CORRECTION: "Correction du déclarant",
  FIELD_INSPECTION: "Inspection de terrain",
  LEGAL_DEROGATION: "Dérogation légale",
};

export interface QualitySummary {
  completenessRate: number | null;
  coherenceRate: number | null;
  anomalyRate: number | null;
  warningRate: number | null;
  statisticalEligibilityRate: number | null;
  totalSubmissions: number;
  blockingAnomaliesCount: number;
  warningsCount: number;
  statisticallyReadyCount: number;
  byRuleFamily: { ruleFamily: string; count: number }[];
  byRegion: { region: string; count: number }[];
}

export function getQualitySummary(campaignId?: string) {
  const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
  return apiFetch<QualitySummary>(`/admin/questionnaires/quality/summary${qs}`);
}

export interface ValidationRuleItem {
  code: string;
  name: string;
  family: string;
  severity: "CRITICAL" | "WARNING";
  isBlocking: boolean;
  description: string;
  enabled: boolean;
}

export function getValidationRules(): Promise<ValidationRuleItem[]> {
  return apiFetch<ValidationRuleItem[]>("/admin/questionnaires/rules");
}
