import { getMe, getMyCompany } from "./api-client";
import { getActiveQuarter } from "./onefop-submission";

/**
 * Options for the queries several components on one page subscribe to at
 * once (the page, the wizard shell, the geography lock, each section
 * screen). With React Query's default staleTime of 0, every new subscriber
 * refetched: one load of the declaration form sent auth/me x9,
 * dsmo/company x9 and onefop/active-quarter x8 — each a database query,
 * enough to exhaust the 15-connection Supabase session pool.
 *
 * A short staleTime makes the subscribers of one page load share a single
 * request; the data is still refetched after it, on focus or remount.
 * initialDataUpdatedAt: 0 keeps a cached user passed as initialData from
 * counting as fresh, so it is still checked against the server once.
 */
export const SHARED_QUERY_STALE_MS = 60_000;

export const meQueryOptions = {
  queryKey: ["auth", "me"] as const,
  queryFn: getMe,
  staleTime: SHARED_QUERY_STALE_MS,
  initialDataUpdatedAt: 0,
};

export const myCompanyQueryOptions = {
  queryKey: ["company", "me"] as const,
  queryFn: getMyCompany,
  staleTime: SHARED_QUERY_STALE_MS,
};

export const activeQuarterQueryOptions = {
  queryKey: ["onefop", "active-quarter"] as const,
  queryFn: getActiveQuarter,
  staleTime: SHARED_QUERY_STALE_MS,
};
