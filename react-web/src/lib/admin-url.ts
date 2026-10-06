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

export const DOSSIER_STATUSES = ["PENDING_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED"] as const;
export type DossierStatus = (typeof DOSSIER_STATUSES)[number];

/** ?status= on /admin/dossiers; "" (every status) for absent or unknown values. */
export function parseDossierStatus(raw: string | null): DossierStatus | "" {
  return (DOSSIER_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as DossierStatus) : "";
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
