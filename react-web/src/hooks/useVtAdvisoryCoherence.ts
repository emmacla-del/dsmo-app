"use client";

import { useEffect, useRef, useState } from "react";
import type { CoherenceFlag } from "@/lib/onefop-submission";
import { vtAdvisoryFlags } from "@/lib/vt-advisory-coherence";

/** Quiet time after the last change to 4.2, 4.7, 4.8 or 4.10 before asking. */
export const VT_ADVISORY_DEBOUNCE_MS = 800;

/**
 * The server's advisory flags (4.2/4.7, 4.2/4.8, 4.7/4.10) for the answers
 * on screen, while Section 4 is filled.
 *
 * `checkKey` is vtAdvisoryCheckKey: null while no compared pair is complete
 * (nothing is asked), otherwise it changes exactly when a compared cell
 * does. The server is asked once per key, after VT_ADVISORY_DEBOUNCE_MS
 * without a change, or at once when the respondent leaves the table
 * (`stepKey` changes) — never once per keystroke: the database pool is
 * small (session mode, pool_size 15).
 *
 * Flags describe one key: as soon as a compared cell changes, the old ones
 * are hidden, since their figures no longer hold. A failed request shows
 * nothing. Advisory only (CLAUDE.md §7): nothing here can block.
 */
export function useVtAdvisoryCoherence({
  checkKey,
  stepKey,
  check,
}: {
  checkKey: string | null;
  stepKey: string;
  check: () => Promise<CoherenceFlag[]>;
}): CoherenceFlag[] {
  const [result, setResult] = useState<{ key: string; flags: CoherenceFlag[] } | null>(null);
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });
  // The request waiting for its quiet time, so leaving the table can send it now.
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; run: () => void } | null>(null);
  const askedKey = useRef<string | null>(null);

  useEffect(() => {
    if (checkKey === null || askedKey.current === checkKey) return;
    let cancelled = false;
    let answered = false;
    const run = () => {
      pending.current = null;
      askedKey.current = checkKey;
      checkRef
        .current()
        .catch(() => [] as CoherenceFlag[])
        .then((flags) => {
          if (cancelled) return;
          answered = true;
          setResult({ key: checkKey, flags: vtAdvisoryFlags(flags ?? []) });
        });
    };
    pending.current = { timer: setTimeout(run, VT_ADVISORY_DEBOUNCE_MS), run };
    return () => {
      cancelled = true;
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current = null;
      }
      // A key dropped before its answer came back is asked again if it returns.
      if (!answered && askedKey.current === checkKey) askedKey.current = null;
    };
  }, [checkKey]);

  // Leaving the table: send what is waiting rather than wait out the delay.
  useEffect(() => {
    const waiting = pending.current;
    if (!waiting) return;
    clearTimeout(waiting.timer);
    waiting.run();
  }, [stepKey]);

  return result && checkKey !== null && result.key === checkKey ? result.flags : [];
}
