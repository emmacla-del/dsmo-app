"use client";

import { useSyncExternalStore } from "react";

function subscribeNoop() {
  return () => {};
}

/**
 * False on the server and during hydration, true afterwards. Replaces the
 * `const [mounted, setMounted] = useState(false); useEffect(() =>
 * setMounted(true), [])` gate: React renders the server snapshot (false)
 * while hydrating, so the first client render matches the server HTML, then
 * re-renders with the client snapshot (true) — no hydration mismatch.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
