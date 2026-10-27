// src/lib/admin-url.ts
//
// URL state for admin pages whose views and filters live in the query string,
// so a reload — or a shared link — reopens the same view with the same
// filters. Pure functions, no React: each page reads its parameters through
// a parser here and writes them back through `hrefWith`.

import type { AnomalyStatus } from "./anomaly-registry";

/**
 * `pathname` with the current query string, after setting (or, for null /
 * "", removing) the given parameters. Every parameter not named is kept, so
 * changing one filter never drops another.
 */
export function hrefWith(pathname: string, current: string, changes: Record<string, string | number | null>): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

// ── /admin/dossiers ─────────────────────────────────────────────────────────

// SUPERSEDED: files a newer submission replaced; listed only on request.
export const DOSSIER_STATUSES = ["PENDING_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED", "SUPERSEDED"] as const;
export type DossierStatus = (typeof DOSSIER_STATUSES)[number];

/** ?status= on /admin/dossiers; "" (every status) for absent or unknown values. */
export function parseDossierStatus(raw: string | null): DossierStatus | "" {
  return (DOSSIER_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as DossierStatus) : "";
}

/** ?sort=oldest on /admin/dossiers lists the longest-waiting files first. */
export type DossierSort = "oldest" | "";

/** ?sort= on /admin/dossiers; "" (newest first) for absent or unknown values. */
export function parseDossierSort(raw: string | null): DossierSort {
  return raw === "oldest" ? "oldest" : "";
}

// ADR-0001 / Phase 3: vue values will be renamed to registrations: queue |
// organisations | coverage; declarations: submissions | completed | coverage.
// vue is presentation only and grants no permission. Update parsers, tabs,
// link helpers, and labels together. See docs/plans/admin-modules-refactor.md
// Phase 3.
/** ?vue= on /admin/dossiers; the file list unless coverage is asked for. */
export const DOSSIER_VUES = ["dossiers", "couverture"] as const;
export type DossierVue = (typeof DOSSIER_VUES)[number];

export function parseDossierVue(raw: string | null): DossierVue {
  return (DOSSIER_VUES as readonly string[]).includes(raw ?? "") ? (raw as DossierVue) : "dossiers";
}

/**
 * A flag filter such as ?late=1 or ?overdue=1. Only an explicit true is
 * active: an absent parameter, an empty one, or an unknown one means "no
 * filter", never "false".
 */
export function parseDossierFlag(raw: string | null): boolean {
  return raw === "1" || raw?.toLowerCase() === "true";
}

/** ?quarterCode=YYYY-Tn; null for absent or malformed values. */
export function parseDossierQuarter(raw: string | null): string | null {
  const value = raw?.trim() ?? "";
  return /^\d{4}-T[1-4]$/.test(value) ? value : null;
}

/** The most recent quarter codes, newest first, for the list's quarter filter. */
export function recentDossierQuarters(now: Date, count = 8): string[] {
  let year = now.getUTCFullYear();
  let quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(`${year}-T${quarter}`);
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
  }
  return codes;
}

// ── /admin/centre-qualite ───────────────────────────────────────────────────

export const QUALITE_VUES = ["indicateurs", "registre", "regles"] as const;
export type QualiteVue = (typeof QUALITE_VUES)[number];

/** ?vue= on /admin/centre-qualite; the indicators for absent or unknown values. */
export function parseQualiteVue(raw: string | null): QualiteVue {
  return (QUALITE_VUES as readonly string[]).includes(raw ?? "") ? (raw as QualiteVue) : "indicateurs";
}

const ANOMALY_STATUSES: readonly AnomalyStatus[] = ["OPEN", "RESOLVED", "WAIVED"];

/** Register ?status=; "ALL" for absent or unknown values. */
export function parseAnomalyStatusFilter(raw: string | null): "ALL" | AnomalyStatus {
  return (ANOMALY_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as AnomalyStatus) : "ALL";
}

/** Register ?severity=; "ALL" for absent or unknown values. */
export function parseSeverityFilter(raw: string | null): "ALL" | "BLOCKING" | "WARNING" {
  return raw === "BLOCKING" || raw === "WARNING" ? raw : "ALL";
}

/**
 * Link to the anomaly register, optionally pre-filtered — e.g. the pilotage
 * "Alertes qualité" tile, or a shared "open blocking anomalies" view.
 */
export function anomalyRegisterHref(filters: { status?: AnomalyStatus; severity?: "BLOCKING" | "WARNING" } = {}): string {
  return hrefWith("/admin/centre-qualite", "", { vue: "registre", status: filters.status ?? null, severity: filters.severity ?? null });
}
