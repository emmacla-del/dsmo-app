"use client";

// The state of the respondent's draft **on the server** (audit R2).
//
// The wizard writes every change to IndexedDB (use-onefop-draft.ts), but
// that is an offline buffer on one device: a respondent who clears their
// browser, or comes back on another computer, has only what reached their
// account. The masthead therefore reports this state, not that one, and
// never calls the local copy "saved to your account".
//
// The server is written when the respondent leaves — closing the tab or the
// window, switching away from it, or pressing Exit — and when they ask for
// it ("Save and come back later", or the masthead's retry). Not on every
// step: one save per batch of answers, at the moment they stop, rather than
// a request per screen (owner, 2026-10-11; the pool ceiling in
// project-db-session-pool-ceiling is why).
//
// A save at closing time is best-effort by nature: `keepalive` lets the
// request outlive the page, but a crash or a killed tab can still take the
// last answers with it — they stay in the local buffer for that device.

import { useCallback, useEffect, useRef, useState } from "react";

export type ServerSaveState = "idle" | "saving" | "saved" | "failed";

export interface OnefopServerSave {
  state: ServerSaveState;
  /** When the last successful save landed, for "Saved to your account 14:32". */
  savedAt: Date | null;
  /** True while answers are only in the local buffer. */
  hasUnsavedChanges: boolean;
  /** Saves now; resolves true once the draft is on the server. */
  saveNow: () => Promise<boolean>;
}

export interface ServerSaveOptions {
  /**
   * The answers as loaded (useOnefopDraft's `loadedData`): already on the
   * account, so opening the wizard and leaving it unchanged sends nothing.
   * Opening it used to write the draft back on every visit.
   */
  baseline?: unknown;
  /**
   * False once the declaration is submitted, or when the period's
   * declaration is awaiting review or endorsed: nothing is sent, on leaving
   * or on request (the server refuses those writes too).
   */
  enabled?: boolean;
}

/**
 * Tracks the draft's server state. `data` is the wizard's current answers:
 * its identity is what tells saved apart from changed-since-saved, so the
 * caller must keep passing the same object while nothing changes (as
 * useOnefopDraft does).
 */
export function useOnefopServerSave(
  data: unknown,
  save: (options: { keepalive: boolean }) => Promise<unknown>,
  { baseline, enabled = true }: ServerSaveOptions = {},
): OnefopServerSave {
  const [state, setState] = useState<ServerSaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savedData, setSavedData] = useState<unknown>(undefined);
  const saveRef = useRef(save);
  const dataRef = useRef(data);
  const runningRef = useRef<Promise<boolean> | null>(null);
  const enabledRef = useRef(enabled);
  const againRef = useRef(false);

  useEffect(() => {
    saveRef.current = save;
    dataRef.current = data;
    enabledRef.current = enabled;
  });

  const run = useCallback(async (keepalive: boolean): Promise<boolean> => {
    if (!enabledRef.current) return false;
    const running = runningRef.current;
    if (running) {
      // Fold into the save in flight; the loop below then runs once more
      // with the answers that arrived while it was running.
      againRef.current = true;
      return running;
    }
    let ok = false;
    do {
      againRef.current = false;
      const sending = dataRef.current;
      const attempt = (async (): Promise<boolean> => {
        setState("saving");
        try {
          await saveRef.current({ keepalive });
          setState("saved");
          setSavedAt(new Date());
          setSavedData(sending);
          return true;
        } catch {
          setState("failed");
          return false;
        }
      })();
      runningRef.current = attempt;
      ok = await attempt;
      runningRef.current = null;
    } while (againRef.current);
    return ok;
  }, []);

  const saveNow = useCallback(() => run(false), [run]);

  // Everything typed since the last save that landed is on this device only.
  // Before the first save, the loaded answers are what the account holds.
  const hasUnsavedChanges = enabled && (savedData === undefined ? baseline === undefined || baseline !== data : savedData !== data);

  useSaveOnLeave(hasUnsavedChanges, () => void run(true).catch(() => {}));

  return { state, savedAt, hasUnsavedChanges, saveNow };
}

/**
 * Calls `leave` once when the page is being left with answers that have not
 * reached the server. `pagehide` covers closing the tab and navigating away;
 * `visibilitychange` covers switching tab or app, which on mobile is often
 * the last event a page gets. Both can fire for one departure, so a save is
 * sent only once per batch of changes.
 */
function useSaveOnLeave(hasUnsavedChanges: boolean, leave: () => void) {
  const leaveRef = useRef(leave);
  const dirtyRef = useRef(hasUnsavedChanges);
  const sentRef = useRef(false);

  useEffect(() => {
    leaveRef.current = leave;
    dirtyRef.current = hasUnsavedChanges;
  });

  // New answers since the last departure save: the next one may send again.
  useEffect(() => {
    if (hasUnsavedChanges) sentRef.current = false;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onLeave = () => {
      if (!dirtyRef.current || sentRef.current) return;
      sentRef.current = true;
      leaveRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
