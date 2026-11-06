/**
 * Whether the staff console rail shows full labels (expanded) or only icons
 * (compact, the default). Stored per browser; every read and write is guarded
 * because storage can be missing or blocked (private windows, previews).
 */

export const ADMIN_RAIL_EXPANDED_KEY = "camleap.adminRail.expanded";

const listeners = new Set<() => void>();

// Fallback when storage throws, so the toggle still works for this visit.
let memoryValue: boolean | null = null;

export function readAdminRailExpanded(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_RAIL_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAdminRailExpanded(expanded: boolean): void {
  try {
    if (expanded) window.localStorage.setItem(ADMIN_RAIL_EXPANDED_KEY, "1");
    else window.localStorage.removeItem(ADMIN_RAIL_EXPANDED_KEY);
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

/** Server render and first paint: compact, the default. */
export function getAdminRailExpandedServerSnapshot(): boolean {
  return false;
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
