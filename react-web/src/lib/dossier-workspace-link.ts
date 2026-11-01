/**
 * Links from the review queue into the review workspace. Every way in carries
 * the queue's return URL, so Previous / Next and the way back keep the
 * reviewer's view, filters and page (plan, Phases 1.5a and 1.5b).
 */
export function dossierWorkspaceHref(
  id: string,
  returnTo: string,
  options: { readOnly?: boolean; includeArchived?: boolean; openApprove?: boolean; focusVerify?: boolean } = {},
): string {
  const query = new URLSearchParams({ returnTo });
  if (options.readOnly) query.set("readOnly", "true");
  if (options.includeArchived) query.set("includeArchived", "true");
  // The workspace opens the approval dialog only when the file is clean; on a
  // file with a blocking anomaly it stays put and the bar says why.
  if (options.openApprove) query.set("openApprove", "1");
  if (options.focusVerify) query.set("focus", "verify");
  return `/admin/dossiers/${encodeURIComponent(id)}?${query.toString()}`;
}

/** URL state of the removed preview drawer, still found in old bookmarks. */
const DRAWER_PARAMS = ["preview", "previewSection"] as const;

/**
 * The queue's query without the drawer's old parameters, or null when there is
 * nothing to remove. Every other filter is kept as it was.
 */
export function withoutDrawerParams(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!DRAWER_PARAMS.some((key) => params.has(key))) return null;
  for (const key of DRAWER_PARAMS) params.delete(key);
  return params.toString();
}
