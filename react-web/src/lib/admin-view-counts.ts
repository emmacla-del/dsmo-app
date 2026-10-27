/** Return counters only when the server says which view they describe. */
export function selectAdminViewCounts<T>(
  countsView: string | undefined,
  expectedView: string,
  counts: T | null | undefined,
): T | null {
  return countsView === expectedView ? counts ?? null : null;
}
