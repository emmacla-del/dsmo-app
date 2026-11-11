import { legacyCompletedDossierHref, parseAdminListPage, parseDossierQueueView } from "./admin-url";
import { legacyOrganisationsDestination } from "./inscriptions";

const DOSSIER_RETURN_FILTERS = [
  ["Status", "status"],
  ["Search", "search"],
  ["FormType", "formType"],
  ["Region", "region"],
  ["Department", "department"],
  ["Period", "period"],
  ["QuarterCode", "quarterCode"],
  ["Late", "late"],
  ["Overdue", "overdue"],
  ["AssignedToMe", "assignedToMe"],
  ["Quality", "quality"],
  ["Assignment", "assignment"],
  ["CompanyId", "companyId"],
  ["Sort", "sort"],
  ["IncludeArchived", "includeArchived"],
] as const;

const ESTABLISHMENT_RETURN_FILTERS = [
  "search",
  "type",
  "region",
  "department",
  "status",
  "year",
  "semester",
  "quarter",
  "sort",
  "includeArchived",
] as const;

function setNonEmpty(params: URLSearchParams, key: string, value: string | null): void {
  if (value !== null && value !== "") params.set(key, value);
}

/** Safe, allowlisted list context for a dossier detail-page return action. */
export function buildDossierReturnTo(currentQuery: string): string {
  const source = new URLSearchParams(currentQuery);
  const rawView = source.get("vue");
  if (rawView === "completed") {
    const migrated = new URL(legacyCompletedDossierHref(source.toString()), "https://camleap.invalid");
    return buildDossierReturnTo(migrated.searchParams.toString());
  }
  const view = rawView === null || rawView === "submissions" || rawView === "dossiers" ? "submissions" : null;
  if (!view) return "/admin/dossiers";

  const result = new URLSearchParams();
  result.set("vue", view);
  const queueView = parseDossierQueueView(source.get("queueView"));
  if (view === "submissions" && queueView) result.set("queueView", queueView);
  setNonEmpty(result, "campaignId", source.get("campaignId"));

  for (const [suffix, legacyKey] of DOSSIER_RETURN_FILTERS) {
    const scopedKey = `${view}${suffix}`;
    setNonEmpty(result, scopedKey, source.get(scopedKey) ?? source.get(legacyKey));
  }
  const searchKey = `${view}Search`;
  if (!result.has(searchKey)) setNonEmpty(result, searchKey, source.get("search") ?? source.get("q"));
  const page = parseAdminListPage(source.get(`${view}Page`) ?? source.get("page"));
  if (page > 1) result.set(`${view}Page`, String(page));

  return `/admin/dossiers?${result.toString()}`;
}

/** Safe, allowlisted establishment-register context for a detail return action. */
export function buildEstablishmentReturnTo(currentQuery: string): string {
  const source = new URLSearchParams(currentQuery);
  const result = new URLSearchParams();
  for (const key of ESTABLISHMENT_RETURN_FILTERS) setNonEmpty(result, key, source.get(key));
  const status = source.get("status");
  if (status !== "ACTIVE" && status !== "SUSPENDED") result.delete("status");
  if (result.get("includeArchived") !== "true") result.delete("includeArchived");
  const page = parseAdminListPage(source.get("page"));
  if (page > 1) result.set("page", String(page));

  const query = result.toString();
  return `/admin/etablissements${query ? `?${query}` : ""}`;
}

function parseLocalAdminUrl(value: string | null): URL | null {
  const raw = value?.trim() ?? "";
  if (!raw || raw !== value || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) {
    return null;
  }
  try {
    const parsed = new URL(raw, "https://camleap.invalid");
    if (parsed.origin !== "https://camleap.invalid" || parsed.username || parsed.password || parsed.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Validate the detail-page return destination and discard unknown query parameters. */
export function resolveDossierReturnTo(value: string | null): string {
  const parsed = parseLocalAdminUrl(value);
  if (!parsed || parsed.pathname !== "/admin/dossiers") return "/admin/dossiers";
  return buildDossierReturnTo(parsed.searchParams.toString());
}

/** Establishments return only to a validated, filtered register URL. */
export function resolveEstablishmentReturnTo(value: string | null): string {
  const parsed = parseLocalAdminUrl(value);
  if (!parsed) return "/admin/etablissements";
  if (parsed.pathname === "/admin/inscriptions" && parsed.searchParams.get("vue") === "organisations") {
    return legacyOrganisationsDestination(parsed.searchParams);
  }
  if (parsed.pathname !== "/admin/etablissements") return "/admin/etablissements";
  return buildEstablishmentReturnTo(parsed.searchParams.toString());
}
