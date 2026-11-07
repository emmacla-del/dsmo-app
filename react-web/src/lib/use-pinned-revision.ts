import { useState } from "react";

/**
 * The revision a reviewer is working from, held still while the page's data
 * refreshes.
 *
 * A background refetch can bring a newer file while the reviewer's marks stay
 * on screen. Sending the latest revision would then pass the server's check
 * with marks made on the old values, so the first settled revision is kept
 * until the reviewer reloads on purpose (the second value returned).
 *
 * Pass undefined while a fetch is in flight, so a cached file is not pinned
 * just before a fresher one arrives.
 */
export function usePinnedRevision(settled: string | undefined) {
  const [pinned, setPinned] = useState<string | null>(null);
  if (pinned === null && settled) setPinned(settled);
  return [pinned, setPinned] as const;
}
