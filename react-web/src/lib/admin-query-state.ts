/** True for a background request that can keep already-rendered results visible. */
export function isBackgroundRefreshing(isFetching: boolean, data: unknown): boolean {
  // Terminal React Query errors return isFetching to false; only the current
  // request state controls this indicator, so a retained response cannot
  // leave the panel busy after either success or failure.
  return isFetching && data !== undefined;
}

/** Use the offset belonging to visible placeholder rows until new rows commit. */
export function displayedResultOffset(requestedOffset: number, resultOffset: number, isPlaceholderData: boolean): number {
  return isPlaceholderData ? resultOffset : requestedOffset;
}

/** Inclusive row range for the results currently rendered in a paged table. */
export function adminResultRange(offset: number, rowCount: number, total: number): { start: number; end: number } {
  if (rowCount <= 0) return { start: 0, end: 0 };
  return {
    start: Math.max(0, offset) + 1,
    end: Math.min(total, Math.max(0, offset) + rowCount),
  };
}
