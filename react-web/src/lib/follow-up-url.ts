import { parseAdminListPage } from "./admin-url";

export const FOLLOW_UP_PAGE_SIZE = 15;

export const FOLLOW_UP_FILTER_KEYS = [
  "followupSearch",
  "followupRegion",
  "followupDepartment",
  "followupType",
  "followupOutcome",
  "followupPage",
] as const;

export type FollowUpFilterName = "search" | "region" | "department" | "type" | "outcome" | "page";
export type FollowUpFilterChanges = Partial<Record<FollowUpFilterName, string | number | null>>;

export interface FollowUpFilterOptions {
  regions: readonly string[];
  departments: readonly { region: string | null; name: string }[];
  types: readonly string[];
  canShowContacts: boolean;
}

export interface FollowUpUrlState {
  search: string;
  region: string;
  department: string;
  type: string;
  outcome: string;
  page: number;
}

const FOLLOW_UP_OUTCOMES = [
  "NONE",
  "CONTACTED",
  "SENT_CONFIRMED",
  "NO_ANSWER",
  "WRONG_NUMBER",
  "CALLBACK_REQUESTED",
  "ALREADY_SUBMITTED",
  "DO_NOT_CONTACT",
] as const;

function departmentIsValid(
  department: string,
  region: string,
  options: FollowUpFilterOptions,
): boolean {
  return options.departments.some((item) => item.name === department && (!region || item.region === region));
}

/** Parse and normalize the Follow-up view state using the campaign's available options. */
export function parseFollowUpUrlState(current: string, options: FollowUpFilterOptions): FollowUpUrlState {
  const params = new URLSearchParams(current);
  const requestedRegion = params.get("followupRegion")?.trim() ?? "";
  const region = options.regions.includes(requestedRegion) ? requestedRegion : "";
  const requestedDepartment = params.get("followupDepartment")?.trim() ?? "";
  const department = requestedDepartment && departmentIsValid(requestedDepartment, region, options)
    ? requestedDepartment
    : "";
  const requestedType = params.get("followupType")?.trim() ?? "";
  const type = options.types.includes(requestedType) ? requestedType : "";
  const requestedOutcome = params.get("followupOutcome")?.trim() ?? "";
  const outcome = options.canShowContacts && (FOLLOW_UP_OUTCOMES as readonly string[]).includes(requestedOutcome)
    ? requestedOutcome
    : "";

  return {
    search: params.get("followupSearch")?.trim() ?? "",
    region,
    department,
    type,
    outcome,
    page: parseAdminListPage(params.get("followupPage")),
  };
}

/** Remove malformed/unsupported Follow-up values while preserving parent and unrelated route context. */
export function normalizeFollowUpQuery(current: string, options: FollowUpFilterOptions): string {
  const params = new URLSearchParams(current);
  const state = parseFollowUpUrlState(current, options);
  const normalized: Array<[string, string]> = [
    ["followupSearch", state.search],
    ["followupRegion", state.region],
    ["followupDepartment", state.department],
    ["followupType", state.type],
    ["followupOutcome", state.outcome],
  ];
  for (const [key, value] of normalized) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  if (state.page > 1) params.set("followupPage", String(state.page));
  else params.delete("followupPage");
  return params.toString();
}

/** Update scoped Follow-up parameters, preserving the campaign and parent-route context. */
export function updateFollowUpQuery(
  current: string,
  changes: FollowUpFilterChanges,
  resetPage = true,
): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    const param = `followup${key[0].toUpperCase()}${key.slice(1)}`;
    if (value == null || value === "" || (key === "page" && Number(value) <= 1)) params.delete(param);
    else params.set(param, String(value).trim());
  }
  if (resetPage && !Object.hasOwn(changes, "page")) params.delete("followupPage");
  return params.toString();
}

/** Clear only Follow-up-owned URL state. */
export function clearFollowUpQuery(current: string): string {
  const params = new URLSearchParams(current);
  for (const key of FOLLOW_UP_FILTER_KEYS) params.delete(key);
  return params.toString();
}

export function followUpHref(pathname: string, query: string): string {
  return `${pathname}${query ? `?${query}` : ""}`;
}

/** Keep a follow-up page number within the filtered client-side result set. */
export function clampFollowUpPage(page: number, total: number): number {
  const lastPage = Math.max(1, Math.ceil(Math.max(0, total) / FOLLOW_UP_PAGE_SIZE));
  return Math.min(Math.max(1, page), lastPage);
}
