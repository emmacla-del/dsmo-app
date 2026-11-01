/**
 * Where the reviewer was in the review queue, per queue URL, for this browser
 * session. The queue saves its scroll position as the reviewer scrolls, so
 * every way into a file (row link, Valider, the preview, Previous / Next)
 * returns to the same place; the queue restores it once its list has
 * rendered, since an empty table cannot be scrolled.
 *
 * Storage is a per-viewer convenience: it can be missing or throw (private
 * windows, blocked site data), and the queue then simply opens at the top.
 */
const DOSSIER_SCROLL_PREFIX = "cam:dossier-queue-scroll:";

type StorageGetter = () => Pick<Storage, "getItem" | "setItem"> | null | undefined;

/** One key per queue view, filters and page: the queue's canonical return URL. */
export function dossierQueueScrollKey(queueUrl: string): string {
  return `${DOSSIER_SCROLL_PREFIX}${queueUrl}`;
}

export function saveDossierQueueScroll(getStorage: StorageGetter, key: string, scrollY: number): void {
  try {
    if (!Number.isFinite(scrollY) || scrollY < 0) return;
    getStorage()?.setItem(key, String(Math.round(scrollY)));
  } catch {
    // Unavailable storage only costs the reviewer their place in the list.
  }
}

export function readDossierQueueScroll(getStorage: StorageGetter, key: string): number | null {
  try {
    const value = getStorage()?.getItem(key);
    if (value == null || !/^\d+$/.test(value)) return null;
    const position = Number(value);
    return Number.isSafeInteger(position) ? position : null;
  } catch {
    return null;
  }
}
