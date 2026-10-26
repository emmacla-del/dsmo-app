"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tableau / Guidé: one entry-mode choice for the whole declaration. Every
 * table that offers both modes follows it until the respondent switches
 * again. Remembered in this browser only — a convenience, never part of the
 * declaration data.
 *
 * On a phone there is no choice: Guidé is the only mode (owner,
 * 2026-10-20). A cross-tabulation grid is four columns of cells wide before
 * its row labels, and no amount of sideways scrolling makes that a form a
 * thumb can fill. Below the breakpoint the switch is not shown and the
 * stored choice is ignored — not overwritten, so the same browser on a
 * wider screen finds it again.
 *
 * One store for both wizards, so the choice and the phone rule cannot
 * differ between them.
 */
export type EntryMode = "grid" | "guided";

export const ENTRY_MODE_STORAGE_KEY = "camleap.onefop.entryMode";
const CHANGE_EVENT = "camleap:entry-mode-change";

// Holds the choice for this page session when storage is unavailable.
let sessionChoice: EntryMode | null = null;

function isEntryMode(value: unknown): value is EntryMode {
  return value === "grid" || value === "guided";
}

function readStored(): EntryMode | null {
  try {
    const saved = window.localStorage.getItem(ENTRY_MODE_STORAGE_KEY);
    if (isEntryMode(saved)) return saved;
  } catch {
    /* storage unavailable — fall back to the session choice */
  }
  return sessionChoice;
}

/** Narrower than a tablet's portrait width: a phone. */
export const PHONE_VIEWPORT_QUERY = "(max-width: 767px)";

function phoneQuery(): MediaQueryList | null {
  return window.matchMedia?.(PHONE_VIEWPORT_QUERY) ?? null;
}

function onPhone(): boolean {
  return phoneQuery()?.matches ?? false;
}

function getSnapshot(): EntryMode {
  if (onPhone()) {
    // Phones: guided only. Never honor a stored 'grid' choice.
    return "guided";
  }
  const stored = readStored();
  return stored ?? "grid";
}

function getServerSnapshot(): EntryMode {
  return "grid";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab of the same browser changed it.
  window.addEventListener("storage", onChange);
  // A phone turned to landscape, or a window dragged past the breakpoint,
  // changes which mode applies.
  const mq = phoneQuery();
  mq?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    mq?.removeEventListener?.("change", onChange);
  };
}

/**
 * True while the viewport is a phone's, where Guidé is the only mode and
 * the switch is not offered.
 */
export function useIsPhoneViewport(): boolean {
  return useSyncExternalStore(subscribe, onPhone, () => false);
}

export function useEntryMode(): [EntryMode, (mode: EntryMode) => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setMode = useCallback((next: EntryMode) => {
    try {
      window.localStorage.setItem(ENTRY_MODE_STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the choice still applies for this session.
      sessionChoice = next;
    }
    window.dispatchEvent(new window.Event(CHANGE_EVENT));
  }, []);
  return [mode, setMode];
}
