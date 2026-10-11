"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tableau / Guidé: one entry-mode choice for the whole declaration. Every
 * table that offers both modes follows it until the respondent switches
 * again. Remembered in this browser only — a convenience, never part of the
 * declaration data. First visit: Guidé on phones, Tableau otherwise.
 *
 * Same storage key as ModernJobsWizard's own copy of this choice, so a
 * respondent who picked a mode there finds it again here.
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

function viewportDefault(): EntryMode {
  return window.matchMedia?.("(max-width: 767px)").matches ? "guided" : "grid";
}

function getSnapshot(): EntryMode {
  return readStored() ?? viewportDefault();
}

function getServerSnapshot(): EntryMode {
  return "grid";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab of the same browser changed it.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
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
