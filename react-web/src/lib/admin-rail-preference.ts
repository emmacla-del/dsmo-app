/**
 * Whether the staff console rail shows full labels (expanded) or only icons
 * (compact). Expanded is the default since 2026-11-08 (owner: labelled
 * navigation for a government console); the compact strip is remembered
 * as "0". Stored per browser; every read and write is guarded
 * because storage can be missing or blocked (private windows, previews).
 */

export const ADMIN_RAIL_EXPANDED_KEY = "camleap.adminRail.expanded";

const listeners = new Set<() => void>();

// Fallback when storage throws, so the toggle still works for this visit.
let memoryValue: boolean | null = null;

export function readAdminRailExpanded(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_RAIL_EXPANDED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeAdminRailExpanded(expanded: boolean): void {
  try {
    if (expanded) window.localStorage.removeItem(ADMIN_RAIL_EXPANDED_KEY);
    else window.localStorage.setItem(ADMIN_RAIL_EXPANDED_KEY, "0");
  } catch {
    // Not stored: the choice still applies until the page is reloaded.
    memoryValue = expanded;
  }
  listeners.forEach((listener) => listener());
}

export function getAdminRailExpandedSnapshot(): boolean {
  if (memoryValue !== null) return memoryValue;
  return readAdminRailExpanded();
}

/** Server render and first paint: expanded, the default. */
export function getAdminRailExpandedServerSnapshot(): boolean {
  return true;
}

export function subscribeAdminRailExpanded(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_RAIL_EXPANDED_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
