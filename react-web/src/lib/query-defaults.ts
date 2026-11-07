/** How old a screen's data must be before coming back to the tab reloads it. */
export const FOCUS_REFETCH_AFTER_MS = 5 * 60_000;

/**
 * The library's default reloads every request on the screen each time the tab
 * regains focus, however fresh the data. Each request costs several database
 * round trips, so switching tabs was the largest source of repeated calls.
 * Data older than the limit still reloads, so a screen left open does not stay
 * out of date. Decisions refresh their lists by invalidation, not through this.
 */
export function refetchOnFocusWhenOld(query: { state: { dataUpdatedAt: number } }, now = Date.now()): boolean {
  return now - query.state.dataUpdatedAt >= FOCUS_REFETCH_AFTER_MS;
}

export const QUERY_CLIENT_DEFAULTS = {
  queries: { refetchOnWindowFocus: (query: { state: { dataUpdatedAt: number } }) => refetchOnFocusWhenOld(query) },
};
