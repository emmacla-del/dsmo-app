// src/lib/admin-url.ts
//
// URL state for admin pages whose views and filters live in the query string,
// so a reload — or a shared link — reopens the same view with the same
// filters. Pure functions, no React: each page reads its parameters through
// a parser here and writes them back through `hrefWith`.

import { ANOMALY_RULE_FAMILIES, type AnomalyRuleFamily, type AnomalyStatus } from "./anomaly-registry";

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

/** Positive, finite page number from an admin list URL; malformed values mean page 1. */
export function parseAdminListPage(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Keep a requested page within the result set while retaining page 1 for an empty list. */
export function clampAdminListPage(page: number, total: number, pageSize: number): number {
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 1;
  const lastPage = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  return Math.min(Math.max(1, Number.isSafeInteger(page) ? page : 1), lastPage);
}

// ── /admin/dossiers ─────────────────────────────────────────────────────────

// SUPERSEDED: files a newer submission replaced; listed only on request.
export const DOSSIER_STATUSES = ["PENDING_REVIEW", "CORRECTION_REQUESTED", "APPROVED", "REJECTED", "SUPERSEDED"] as const;
export type DossierStatus = (typeof DOSSIER_STATUSES)[number];

export const DOSSIER_QUALITIES = ["clean", "warnings", "blocking"] as const;
export type DossierQuality = (typeof DOSSIER_QUALITIES)[number];

export const DOSSIER_PERIODS = ["7d", "30d", "3m", "12m"] as const;
export type DossierPeriod = (typeof DOSSIER_PERIODS)[number];

export const DOSSIER_ASSIGNMENTS = ["me", "unassigned", "other"] as const;
export type DossierAssignment = (typeof DOSSIER_ASSIGNMENTS)[number];

/** ?status= on /admin/dossiers; "" (every status) for absent or unknown values. */
export function parseDossierStatus(raw: string | null): DossierStatus | "" {
  return (DOSSIER_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as DossierStatus) : "";
}

export function parseDossierQuality(raw: string | null): DossierQuality | "" {
  return (DOSSIER_QUALITIES as readonly string[]).includes(raw ?? "") ? (raw as DossierQuality) : "";
}

export function parseDossierPeriod(raw: string | null): DossierPeriod | "" {
  return (DOSSIER_PERIODS as readonly string[]).includes(raw ?? "") ? (raw as DossierPeriod) : "";
}

export function parseDossierAssignment(raw: string | null): DossierAssignment | "" {
  return (DOSSIER_ASSIGNMENTS as readonly string[]).includes(raw ?? "") ? (raw as DossierAssignment) : "";
}

export interface AdminTerritoryOption {
  name: string;
  departments: readonly { name: string }[];
}

/**
 * Canonicalize filters for the active Dossiers list view. Explicit assignment
 * wins over the legacy assignedToMe flag; an invalid explicit value falls
 * back to a valid legacy true flag. A campaign wins over quarterCode because
 * the campaign already identifies its quarter. Unknown query parameters and
 * inactive-view filters are retained.
 */
export function normalizeDossierListHref(
  current: string,
  view: "submissions" | "completed",
  formTypes: readonly string[],
  territories?: readonly AdminTerritoryOption[],
): string {
  const params = new URLSearchParams(current);
  const legacyApplies = parseDossierVue(params.get("vue")) === view;
  const scopedKey = (key: string) => `${view}${key[0].toUpperCase()}${key.slice(1)}`;
  const readFilter = (key: string) => params.get(scopedKey(key)) ?? (legacyApplies ? params.get(key) : null);
  const writeFilter = (key: string, value: string | null) => {
    const target = scopedKey(key);
    if (value) params.set(target, value);
    else params.delete(target);
    if (legacyApplies) params.delete(key);
  };

  const rawSearch = readFilter("search") ?? (legacyApplies ? params.get("q") : null);
  writeFilter("search", rawSearch?.trim() || null);
  if (legacyApplies) params.delete("q");

  const status = parseDossierStatus(readFilter("status"));
  const viewStatus = view === "completed"
    ? ["APPROVED", "REJECTED", "SUPERSEDED"].includes(status)
    : Boolean(status);
  writeFilter("status", viewStatus ? status : null);

  const sort = parseDossierSort(readFilter("sort"));
  writeFilter("sort", sort || null);
  const formType = readFilter("formType")?.trim() ?? "";
  writeFilter("formType", formTypes.includes(formType) ? formType : null);
  const period = parseDossierPeriod(readFilter("period"));
  writeFilter("period", period || null);

  let region = readFilter("region")?.trim() ?? "";
  let department = readFilter("department")?.trim() ?? "";
  if (territories) {
    const selectedRegion = territories.find((item) => item.name === region);
    if (region && !selectedRegion) {
      region = "";
      department = "";
    } else if (department) {
      const validDepartment = selectedRegion
        ? selectedRegion.departments.some((item) => item.name === department)
        : territories.some((item) => item.departments.some((child) => child.name === department));
      if (!validDepartment) department = "";
    }
  }
  writeFilter("region", region || null);
  writeFilter("department", department || null);

  const assignment = parseDossierAssignment(readFilter("assignment"));
  const legacyAssignedToMe = parseDossierFlag(readFilter("assignedToMe"));
  writeFilter("assignment", assignment || (legacyAssignedToMe ? "me" : null));
  writeFilter("assignedToMe", null);

  const quality = parseDossierQuality(readFilter("quality"));
  writeFilter("quality", quality || null);
  const late = parseDossierFlag(readFilter("late"));
  writeFilter("late", late ? "1" : null);
  const overdue = view === "completed" ? false : parseDossierFlag(readFilter("overdue"));
  writeFilter("overdue", overdue ? "1" : null);

  const includeArchived = view === "completed" && readFilter("includeArchived") === "false";
  writeFilter("includeArchived", includeArchived ? "false" : null);

  const companyId = readFilter("companyId")?.trim() ?? "";
  writeFilter("companyId", companyId || null);

  const campaignId = params.get("campaignId")?.trim() ?? "";
  if (campaignId) params.set("campaignId", campaignId);
  else params.delete("campaignId");
  const quarterCode = campaignId ? null : parseDossierQuarter(readFilter("quarterCode"));
  writeFilter("quarterCode", quarterCode);

  const page = parseAdminListPage(readFilter("page"));
  writeFilter("page", page > 1 ? String(page) : null);
  // `statuses` is an API parameter, not a supported Dossiers page filter.
  params.delete("statuses");

  const query = params.toString();
  return `/admin/dossiers${query ? `?${query}` : ""}`;
}

/** ?sort=oldest on /admin/dossiers lists the longest-waiting files first. */
export type DossierSort = "oldest" | "";

/** ?sort= on /admin/dossiers; "" (newest first) for absent or unknown values. */
export function parseDossierSort(raw: string | null): DossierSort {
  return raw === "oldest" ? "oldest" : "";
}

/** Registration views. Legacy values remain parser aliases for saved links. */
export const REGISTRATION_VUES = ["queue", "organisations", "coverage"] as const;
export type RegistrationVue = (typeof REGISTRATION_VUES)[number];

export function parseRegistrationVue(raw: string | null): RegistrationVue {
  if (raw === "file") return "queue";
  if (raw === "couverture") return "coverage";
  return (REGISTRATION_VUES as readonly string[]).includes(raw ?? "")
    ? (raw as RegistrationVue)
    : "queue";
}

/** Dossier views. Legacy values remain parser aliases for saved links. */
export const DOSSIER_VUES = ["submissions", "completed", "followup", "coverage"] as const;
export type DossierVue = (typeof DOSSIER_VUES)[number];

export function parseDossierVue(raw: string | null): DossierVue {
  if (raw === "dossiers") return "submissions";
  if (raw === "couverture") return "coverage";
  return (DOSSIER_VUES as readonly string[]).includes(raw ?? "")
    ? (raw as DossierVue)
    : "submissions";
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

/** Register ?family=; "ALL" for absent or unknown values. */
export function parseAnomalyFamilyFilter(raw: string | null): "ALL" | AnomalyRuleFamily {
  return (ANOMALY_RULE_FAMILIES as readonly string[]).includes(raw ?? "")
    ? (raw as AnomalyRuleFamily)
    : "ALL";
}

/**
 * Link to the anomaly register, optionally pre-filtered — e.g. the pilotage
 * "Alertes qualité" tile, or a shared "open blocking anomalies" view.
 */
export function anomalyRegisterHref(filters: { status?: AnomalyStatus; severity?: "BLOCKING" | "WARNING" } = {}): string {
  return hrefWith("/admin/centre-qualite", "", { vue: "registre", status: filters.status ?? null, severity: filters.severity ?? null });
}
