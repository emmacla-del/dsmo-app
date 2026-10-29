import { parseAdminListPage } from "./admin-url";
import { normalizeRegistrationStatus } from "./inscriptions";

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
] as const;

const INSCRIPTIONS_RETURN_FILTERS = [
  "type",
  "region",
  "department",
  "registrationMethod",
  "dateRange",
  "from",
  "to",
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
  const view = rawView === "completed"
    ? "completed"
    : rawView === null || rawView === "submissions" || rawView === "dossiers"
      ? "submissions"
      : null;
  if (!view) return "/admin/dossiers";

  const result = new URLSearchParams();
  result.set("vue", view);
  setNonEmpty(result, "campaignId", source.get("campaignId"));

  for (const [suffix, legacyKey] of DOSSIER_RETURN_FILTERS) {
    const scopedKey = `${view}${suffix}`;
    setNonEmpty(result, scopedKey, source.get(scopedKey) ?? source.get(legacyKey));
  }
  if (view === "completed") {
    setNonEmpty(result, "completedIncludeArchived", source.get("completedIncludeArchived") ?? source.get("includeArchived"));
  }

  const searchKey = `${view}Search`;
  if (!result.has(searchKey)) setNonEmpty(result, searchKey, source.get("search") ?? source.get("q"));
  const page = parseAdminListPage(source.get(`${view}Page`) ?? source.get("page"));
  if (page > 1) result.set(`${view}Page`, String(page));

  return `/admin/dossiers?${result.toString()}`;
}

/** Safe, allowlisted Inscriptions Organisations context for an establishment detail return action. */
export function buildRegistrationReturnTo(currentQuery: string): string {
  const source = new URLSearchParams(currentQuery);
  const result = new URLSearchParams();
  result.set("vue", "organisations");

  const search = source.get("search") ?? source.get("organisation");
  setNonEmpty(result, "search", search);
  const status = normalizeRegistrationStatus(source.get("status"), "organisations");
  setNonEmpty(result, "status", status || null);
  for (const key of INSCRIPTIONS_RETURN_FILTERS) setNonEmpty(result, key, source.get(key));
  const page = parseAdminListPage(source.get("page"));
  if (page > 1) result.set("page", String(page));

  return `/admin/inscriptions?${result.toString()}`;
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

/** Establishments can return to the filtered Organisations view or its normal directory. */
export function resolveEstablishmentReturnTo(value: string | null): string {
  const parsed = parseLocalAdminUrl(value);
  if (!parsed) return "/admin/etablissements";
  if (parsed.pathname === "/admin/etablissements") return "/admin/etablissements";
  if (parsed.pathname !== "/admin/inscriptions" || parsed.searchParams.get("vue") !== "organisations") {
    return "/admin/etablissements";
  }
  return buildRegistrationReturnTo(parsed.searchParams.toString());
}
