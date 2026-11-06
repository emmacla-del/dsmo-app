import type { listCompanyRegistrations } from "./user-directory";

/**
 * The registration queue a reviewer opened a file from, so the review page
 * (/admin/inscriptions/[id]) can say « Inscription 3 sur 8 » and offer
 * Précédente / Suivante in the same order and under the same filters.
 *
 * Kept in sessionStorage (one tab, gone with it): it is navigation context,
 * not data. Without it — a link pasted from elsewhere, storage blocked — the
 * page simply shows no position and no previous / next.
 */

export type RegistrationListParams = Omit<Parameters<typeof listCompanyRegistrations>[0], "page" | "pageSize">;

export interface RegistrationTrail {
  /** The queue URL to go back to, already validated. */
  returnTo: string;
  /** The list request the queue made, without paging. */
  params: RegistrationListParams;
  page: number;
  pageSize: number;
  total: number;
  /** The ids on that page, in queue order. */
  ids: string[];
  /**
   * Files decided since the queue was opened. A decision moves the rows behind
   * it up the live list, so a page number read earlier no longer says where
   * the next file is: see findNextInQueue.
   */
  decided?: string[];
}

const STORAGE_KEY = "camleap.registrationTrail";
export const REGISTRATION_QUEUE_HREF = "/admin/inscriptions?vue=queue";

function isTrail(value: unknown): value is RegistrationTrail {
  if (!value || typeof value !== "object") return false;
  const trail = value as Partial<RegistrationTrail>;
  return typeof trail.returnTo === "string"
    && !!trail.params && typeof trail.params === "object"
    && Number.isInteger(trail.page) && (trail.page ?? 0) >= 1
    && Number.isInteger(trail.pageSize) && (trail.pageSize ?? 0) >= 1
    && Number.isInteger(trail.total) && (trail.total ?? -1) >= 0
    && Array.isArray(trail.ids) && trail.ids.every((id) => typeof id === "string")
    && (trail.decided === undefined || (Array.isArray(trail.decided) && trail.decided.every((id) => typeof id === "string")));
}

const listeners = new Set<() => void>();

export function saveRegistrationTrail(trail: RegistrationTrail): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
  } catch {
    // Storage blocked: the page opens without position, which is fine.
  }
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore: the stored string is the snapshot (stable between saves). */
export function subscribeRegistrationTrail(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readRegistrationTrailRaw(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseRegistrationTrail(raw: string | null): RegistrationTrail | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTrail(parsed) ? { ...parsed, returnTo: resolveRegistrationReturnTo(parsed.returnTo) } : null;
  } catch {
    return null;
  }
}

/** Only the registration queue itself; anything else falls back to it. */
export function resolveRegistrationReturnTo(value: string | null | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw || raw !== value || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return REGISTRATION_QUEUE_HREF;
  try {
    const parsed = new URL(raw, "https://camleap.invalid");
    if (parsed.origin !== "https://camleap.invalid" || parsed.hash || parsed.pathname !== "/admin/inscriptions") return REGISTRATION_QUEUE_HREF;
    const vue = parsed.searchParams.get("vue");
    if (vue !== null && vue !== "queue") return REGISTRATION_QUEUE_HREF;
    parsed.searchParams.delete("decisionNotice");
    const qs = parsed.searchParams.toString();
    return `/admin/inscriptions${qs ? `?${qs}` : ""}`;
  } catch {
    return REGISTRATION_QUEUE_HREF;
  }
}

export function registrationReviewHref(id: string, returnTo: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ returnTo, ...extra });
  return `/admin/inscriptions/${encodeURIComponent(id)}?${params.toString()}`;
}

export interface TrailPosition {
  /** 1-based, across the whole queue. */
  position: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
  /** The neighbour is on the queue page before / after this one. */
  previousPage: number | null;
  nextPage: number | null;
}

/** Where `id` sits in the trail; null when it is not on the trail's page. */
export function trailPosition(trail: RegistrationTrail | null, id: string): TrailPosition | null {
  if (!trail) return null;
  const index = trail.ids.indexOf(id);
  if (index < 0) return null;
  const position = (trail.page - 1) * trail.pageSize + index + 1;
  const previousId = trail.ids[index - 1] ?? null;
  const nextId = trail.ids[index + 1] ?? null;
  return {
    position,
    total: Math.max(trail.total, position),
    previousId,
    nextId,
    previousPage: !previousId && trail.page > 1 ? trail.page - 1 : null,
    nextPage: !nextId && position < trail.total ? trail.page + 1 : null,
  };
}

/** The trail once `id` has been decided. `stillListed`: the file stays in the filtered list (decisionStaysListed). */
export function trailWithout(trail: RegistrationTrail, id: string, stillListed = false): RegistrationTrail {
  if (!trail.ids.includes(id)) return trail;
  return {
    ...trail,
    ids: trail.ids.filter((value) => value !== id),
    total: stillListed ? trail.total : Math.max(0, trail.total - 1),
    decided: [...(trail.decided ?? []), id],
  };
}

/**
 * Whether a decided file still matches the list's filters. « Tous les statuts »
 * keeps every file, and a file sent back for complements stays in the default
 * queue (attente + compléments) and in the complements filter.
 */
export function decisionStaysListed(params: RegistrationListParams, kind: "approved" | "rejected" | "complements"): boolean {
  if (params.status === "ALL") return true;
  if (kind !== "complements") return false;
  return params.status === "COMPLEMENTS_REQUESTED" || (!params.status && !params.overdue);
}

export interface NextInQueue {
  nextId: string;
  page: number;
  ids: string[];
  total: number;
}

/**
 * The next file past the end of the trail's page, read from the live list.
 *
 * After a decision the rows behind it have moved up, so the file that was first
 * on the next page may now sit on this one: the search starts at this page and
 * skips what the reviewer has already had (this page's ids, the decided files).
 * Rows only ever move up, so no earlier page needs reading.
 */
export async function findNextInQueue(
  trail: RegistrationTrail,
  currentId: string,
  fetchPage: (page: number) => Promise<{ page: number; total: number; items: { id: string }[] }>,
): Promise<NextInQueue | null> {
  const handled = new Set([...trail.ids, ...(trail.decided ?? []), currentId]);
  for (let page = trail.decided?.length ? trail.page : trail.page + 1; ; page += 1) {
    const result = await fetchPage(page);
    const next = result.items.find((row) => !handled.has(row.id));
    if (next) return { nextId: next.id, page: result.page, ids: result.items.map((row) => row.id), total: result.total };
    if (result.items.length === 0 || page * trail.pageSize >= result.total) return null;
  }
}
