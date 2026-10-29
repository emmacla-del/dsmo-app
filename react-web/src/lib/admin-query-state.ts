/** True for a background request that can keep already-rendered results visible. */
export function isBackgroundRefreshing(isFetching: boolean, data: unknown): boolean {
  return isFetching && data !== undefined;
}
