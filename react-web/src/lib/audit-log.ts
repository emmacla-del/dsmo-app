// src/lib/audit-log.ts
//
// GET /audit/reports?paginate=true — src/report/audit.controller.ts.
// Roles: SUPER_ADMIN, ADMIN_ONEFOP, AUDITOR. Rows are platform-wide
// AuditLog entries (no territory scoping), newest first.
import { apiFetch } from "./api-client";
import { directoryRoleLabel } from "./user-directory";
import type { UiLocale } from "./register-i18n";

// Every label below exists in French (the maps above each helper, also used
// by the filters) and English; each helper takes the console locale last and
// defaults to French. Free text stored inside `details` (notes, reasons,
// comments) is shown as stored, in whatever language it was written.

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: unknown;
  previousValue: string | null;
  newValue: string | null;
  timestamp: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null; role: string } | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogParams {
  period?: string;
  actor?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  limit: number;
  offset: number;
}

export function listAuditLog(params: AuditLogParams) {
  const query = new URLSearchParams({ paginate: "true", limit: String(params.limit), offset: String(params.offset) });
  if (params.period) query.set("period", params.period);
  if (params.actor) query.set("actor", params.actor);
  if (params.action) query.set("action", params.action);
  if (params.resourceType) query.set("resourceType", params.resourceType);
  if (params.resourceId) query.set("resourceId", params.resourceId);
  return apiFetch<AuditLogPage>(`/audit/reports?${query.toString()}`);
}

// Same windows as the dossier list (ADMIN_LIST_PERIODS on the backend).
export const AUDIT_PERIODS: Array<{ value: string; label: string }> = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "3m", label: "3 derniers mois" },
  { value: "12m", label: "12 derniers mois" },
];

type Tone = "success" | "warning" | "error" | "info" | "neutral";

// Every action string the backend writes today (grep auditLog.create /
// auditService.log in src/). An action missing here still lists and renders
// under its raw code; it just can't be picked in the "Type d'action" filter.
export const AUDIT_ACTIONS: Record<string, { label: string; tone: Tone }> = {
  AUDIT_BULK_VISA_GRANTED: { label: "Visa en lot", tone: "success" },
  AUDIT_BULK_REJECT:       { label: "Rejet en lot", tone: "error" },
  AUDIT_REJECT:            { label: "Dossier rejeté", tone: "error" },
  AUDIT_CORRECTION:        { label: "Retour pour correction", tone: "warning" },
  AUDIT_LIST_EXPORT:       { label: "Export de la liste des dossiers", tone: "neutral" },
  ANOMALY_RESOLVED:        { label: "Anomalie résolue", tone: "success" },
  ANOMALY_WAIVED:          { label: "Anomalie dérogée", tone: "warning" },
  USER_TERRITORY_CHANGED:  { label: "Rôle / territoire modifié", tone: "info" },
  CREATE_COMPANY_PROFILE:  { label: "Établissement créé", tone: "info" },
  UPDATE_COMPANY:          { label: "Établissement modifié", tone: "neutral" },
  SUBMIT_DECLARATION:      { label: "Déclaration DSMO soumise", tone: "neutral" },
  SEND_NOTIFICATION:       { label: "Notification envoyée", tone: "neutral" },
  GENERATE:                { label: "Rapport généré", tone: "neutral" },
  BATCH_GENERATE:          { label: "Rapports générés en lot", tone: "neutral" },
  APPROVE:                 { label: "Rapport approuvé", tone: "success" },
  REJECT:                  { label: "Rapport rejeté", tone: "error" },
  DISTRIBUTE:              { label: "Rapport diffusé", tone: "neutral" },
  COMPANY_REGISTRATION_APPROVED:      { label: "Inscription approuvée", tone: "success" },
  COMPANY_REGISTRATION_AUTO_APPROVED: { label: "Inscription approuvée automatiquement", tone: "success" },
};

export const AUDIT_RESOURCE_TYPES: Record<string, string> = {
  OnefopSubmission: "Dossier ONEFOP",
  OnefopAnomaly:    "Anomalie",
  User:             "Utilisateur",
  Company:          "Établissement",
  Declaration:      "Déclaration DSMO",
  Notification:     "Notification",
  Report:           "Rapport",
  BatchJob:         "Lot de rapports",
};

const AUDIT_ACTION_LABELS_EN: Record<string, string> = {
  AUDIT_BULK_VISA_GRANTED: "Bulk endorsement",
  AUDIT_BULK_REJECT: "Bulk rejection",
  AUDIT_REJECT: "File rejected",
  AUDIT_CORRECTION: "Returned for correction",
  AUDIT_LIST_EXPORT: "File list export",
  ANOMALY_RESOLVED: "Anomaly resolved",
  ANOMALY_WAIVED: "Anomaly waived",
  USER_TERRITORY_CHANGED: "Role / territory changed",
  CREATE_COMPANY_PROFILE: "Establishment created",
  UPDATE_COMPANY: "Establishment updated",
  SUBMIT_DECLARATION: "DSMO declaration submitted",
  SEND_NOTIFICATION: "Notification sent",
  GENERATE: "Report generated",
  BATCH_GENERATE: "Reports generated in bulk",
  APPROVE: "Report approved",
  REJECT: "Report rejected",
  DISTRIBUTE: "Report distributed",
  COMPANY_REGISTRATION_APPROVED: "Registration approved",
  COMPANY_REGISTRATION_AUTO_APPROVED: "Registration approved automatically",
};

const AUDIT_RESOURCE_TYPES_EN: Record<string, string> = {
  OnefopSubmission: "ONEFOP file",
  OnefopAnomaly: "Anomaly",
  User: "User",
  Company: "Establishment",
  Declaration: "DSMO declaration",
  Notification: "Notification",
  Report: "Report",
  BatchJob: "Report batch",
};

export function auditActionLabel(action: string, locale: UiLocale = "fr"): string {
  if (locale === "en") return AUDIT_ACTION_LABELS_EN[action] ?? action;
  return AUDIT_ACTIONS[action]?.label ?? action;
}

export function auditActionTone(action: string): Tone {
  return AUDIT_ACTIONS[action]?.tone ?? "neutral";
}

export function auditResourceLabel(type: string, locale: UiLocale = "fr"): string {
  const labels = locale === "en" ? AUDIT_RESOURCE_TYPES_EN : AUDIT_RESOURCE_TYPES;
  return labels[type] ?? type;
}

export function auditActorName(e: AuditLogEntry, locale: UiLocale = "fr"): string {
  if (!e.user) return locale === "en" ? "System" : "Système";
  return [e.user.firstName, e.user.lastName].filter(Boolean).join(" ").trim() || e.user.email;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : String(value);
}

/** One readable line from `details` (a string, or a JSON object per action). */
export function auditDetailsSummary(e: AuditLogEntry, locale: UiLocale = "fr"): string {
  const en = locale === "en";
  if (typeof e.details === "string") return e.details.trim() || "—";
  const d = asRecord(e.details);
  if (!d) return "—";
  switch (e.action) {
    case "AUDIT_BULK_VISA_GRANTED": {
      const notes = text(d.notes) ? ` — ${d.notes}` : "";
      return en
        ? `${d.processedCount ?? 0} endorsed, ${d.rejectedCount ?? 0} refused of ${d.totalRequested ?? 0}${notes}`
        : `${d.processedCount ?? 0} visé(s), ${d.rejectedCount ?? 0} refusé(s) sur ${d.totalRequested ?? 0}${notes}`;
    }
    case "AUDIT_BULK_REJECT": {
      const reason = text(d.reason) ? ` — ${d.reason}` : "";
      return en
        ? `${d.rejectedCount ?? 0} rejected, ${d.skippedCount ?? 0} skipped of ${d.totalRequested ?? 0}${reason}`
        : `${d.rejectedCount ?? 0} rejeté(s), ${d.skippedCount ?? 0} ignoré(s) sur ${d.totalRequested ?? 0}${reason}`;
    }
    case "AUDIT_LIST_EXPORT":
      return en
        ? `Format ${text(d.format)?.toUpperCase() ?? "?"} · ${d.count ?? "?"} row(s)`
        : `Format ${text(d.format)?.toUpperCase() ?? "?"} · ${d.count ?? "?"} ligne(s)`;
    case "ANOMALY_RESOLVED":
    case "ANOMALY_WAIVED":
      return [text(d.ruleCode), text(d.resolutionNote)].filter(Boolean).join(" — ") || "—";
    case "USER_TERRITORY_CHANGED":
      return en ? "Role and geographical scope" : "Rôle et périmètre géographique";
    case "COMPANY_REGISTRATION_APPROVED":
    case "COMPANY_REGISTRATION_AUTO_APPROVED":
      return registrationApprovalSummary(d, locale);
  }
  return text(d.reason) ?? text(d.comments) ?? text(d.notes) ?? "—";
}

// The review rows, in the dialog's order and words.
const VERIFIED_ROWS: Array<[flag: string, fr: string, en: string]> = [
  ["nameVerified", "nom", "name"],
  ["phoneVerified", "téléphone", "phone"],
  ["contactEmailVerified", "email", "email"],
  ["cnpsVerified", "CNPS", "CNPS"],
];

/**
 * "Identifiant EN26000712 · vérifié : nom, téléphone, email, CNPS". An
 * approval recorded before the review rows existed, or an automatic one,
 * carries no verification block and reads as the identifier alone.
 */
function registrationApprovalSummary(d: Record<string, unknown>, locale: UiLocale): string {
  const en = locale === "en";
  const parts: string[] = [];
  const id = text(d.establishmentId);
  if (id) parts.push(en ? `ID ${id}` : `Identifiant ${id}`);
  const verification = asRecord(d.verification);
  if (verification) {
    const checked = VERIFIED_ROWS.filter(([flag]) => verification[flag] === true).map(([, fr, enLabel]) => (en ? enLabel : fr));
    if (checked.length > 0) parts.push(en ? `verified: ${checked.join(", ")}` : `vérifié : ${checked.join(", ")}`);
  }
  return parts.join(" · ") || "—";
}

function compact(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "string") return JSON.stringify(value);
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
  } catch {
    return value;
  }
}

// Same labels as the dossier list's visa column.
const SUBMISSION_STATUS_LABELS: Record<UiLocale, Record<string, string>> = {
  fr: {
    PENDING_REVIEW: "En instance",
    APPROVED: "Visé",
    REJECTED: "Rejeté",
    CORRECTION_REQUESTED: "Correction demandée",
  },
  en: {
    PENDING_REVIEW: "Pending",
    APPROVED: "Endorsed",
    REJECTED: "Rejected",
    CORRECTION_REQUESTED: "Correction requested",
  },
};

/** "before → after", or null when the entry records no state change. */
export function auditTransition(e: AuditLogEntry, locale: UiLocale = "fr"): string | null {
  const statusLabel = (status: string) => SUBMISSION_STATUS_LABELS[locale][status] ?? status;
  if (e.previousValue || e.newValue) return `${compact(e.previousValue)} → ${compact(e.newValue)}`;
  const d = asRecord(e.details);
  if (!d) return null;
  if (e.action === "USER_TERRITORY_CHANGED") {
    const side = (role: unknown, region: unknown, dept: unknown) =>
      [text(role) && directoryRoleLabel(String(role), locale), text(region), text(dept)].filter(Boolean).join(" · ") || "—";
    return `${side(d.previousRole, d.previousRegion, d.previousDepartment)} → ${side(d.newRole, d.newRegion, d.newDepartment)}`;
  }
  if (e.action === "AUDIT_CORRECTION" && text(d.previousStatus)) {
    return `${statusLabel(String(d.previousStatus))} → ${statusLabel("CORRECTION_REQUESTED")}`;
  }
  return null;
}
