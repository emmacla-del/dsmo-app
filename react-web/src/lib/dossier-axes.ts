// src/lib/dossier-axes.ts
//
// The three-axis strip on the dossier detail page, derived from the records
// the page already loads:
//
//   axis 1  administrative endorsement  ← the dossier's stored status
//   axis 2  data quality                ← GET .../diagnostic axis2*Count
//   axis 3  statistical eligibility     ← GET .../diagnostic axis3Eligibility
//                                          + exclusionReason
//
// The strip used to print « ⏱ EN INSTANCE », « 🚩 2 Avertissements » and
// « En attente d'arbitrage » on every dossier, copied from the Figma frame.
// Each badge now states the record's own value, or says the value is not
// available — never a stand-in.

import type { DossierDiagnostic } from "./api-client";

export type AxisTone = "success" | "warning" | "error" | "neutral";

/** A badge as a message key (under adminDossierPage) plus its values. */
export interface AxisBadge {
  key: string;
  values?: Record<string, number>;
  tone: AxisTone;
}

/**
 * The backend's StatisticalExclusionReason values
 * (src/types/eligibility.types.ts). Each has a label at
 * adminDossierPage.exclusion.<value>; an unknown value falls back to
 * "not eligible".
 */
export const EXCLUSION_REASONS = [
  "EXCL_BLOCKING_ANOMALY_OPEN",
  "EXCL_WAITING_NAT_VISA",
  "EXCL_CORRECTION_PENDING",
  "EXCL_REJECTED",
  "EXCL_DRAFT_ONLY",
] as const;

const EXCLUSION_TONE: Record<(typeof EXCLUSION_REASONS)[number], AxisTone> = {
  EXCL_BLOCKING_ANOMALY_OPEN: "error",
  EXCL_REJECTED: "error",
  EXCL_WAITING_NAT_VISA: "warning",
  EXCL_CORRECTION_PENDING: "warning",
  EXCL_DRAFT_ONLY: "neutral",
};

const STATUS_AXIS: Record<string, AxisBadge> = {
  PENDING_REVIEW: { key: "statusPending", tone: "warning" },
  APPROVED: { key: "statusEndorsed", tone: "success" },
  CORRECTION_REQUESTED: { key: "statusCorrection", tone: "warning" },
  REJECTED: { key: "statusRejected", tone: "error" },
};

/** Where the diagnostic request stands; only "ready" carries data. */
export type DiagnosticState = "loading" | "unavailable" | "ready";

const LOADING: AxisBadge = { key: "axisLoading", tone: "neutral" };
const UNAVAILABLE: AxisBadge = { key: "axisUnavailable", tone: "neutral" };

/** Axis 1: the stored status; a dossier with none says so. */
export function endorsementAxis(status: string | null | undefined): AxisBadge {
  if (!status) return { key: "statusNotRecorded", tone: "neutral" };
  return STATUS_AXIS[status] ?? { key: "statusNotRecorded", tone: "neutral" };
}

/** Axis 2: open blocking anomalies first, then warnings, then none. */
export function qualityAxis(state: DiagnosticState, diag: DossierDiagnostic | null): AxisBadge {
  if (state === "loading") return LOADING;
  if (state !== "ready" || !diag) return UNAVAILABLE;
  if (diag.axis2BlockingCount > 0) {
    return { key: "axis2Blocking", values: { count: diag.axis2BlockingCount }, tone: "error" };
  }
  if (diag.axis2WarningCount > 0) {
    return { key: "axis2Warnings", values: { count: diag.axis2WarningCount }, tone: "warning" };
  }
  return { key: "axis2None", tone: "success" };
}

/** Axis 3: eligible, or the server's reason for the exclusion. */
export function eligibilityAxis(state: DiagnosticState, diag: DossierDiagnostic | null): AxisBadge {
  if (state === "loading") return LOADING;
  if (state !== "ready" || !diag) return UNAVAILABLE;
  if (diag.axis3Eligibility === "READY") return { key: "axis3Eligible", tone: "success" };
  const reason = diag.exclusionReason as (typeof EXCLUSION_REASONS)[number] | undefined;
  if (reason && (EXCLUSION_REASONS as readonly string[]).includes(reason)) {
    return { key: `exclusion.${reason}`, tone: EXCLUSION_TONE[reason] };
  }
  return { key: "axis3NotEligible", tone: "neutral" };
}
