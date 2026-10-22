"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useIsPhoneViewport } from "@/lib/use-entry-mode";

/**
 * Tableau / Guidé control, shared by the Modern Jobs sections and the VT
 * tables.
 *
 * One control, in the app bar. useEntryMode is a single app-wide store, so
 * the seven call sites were seven views of one setting, each sitting
 * between a question and its table (owner, 2026-10-11). The screens still
 * decide whether the choice applies — that routing lives in
 * VtWizardSectionScreen and SectionRenderer, and duplicating it in the
 * chrome would be a second source of truth — so a screen renders
 * EntryModeSwitchSlot where it used to render the switch.
 *
 * A screen can hold several tables, and all of them render the slot. Only
 * the first to register draws the control; the rest render nothing, or the
 * app bar would carry one selector per table on the screen.
 *
 * It is one button that names the other mode (owner, 2026-10-22): « Passer
 * en guidé » in Tableau, « Passer en tableau » in Guidé. From 2026-10-12 it
 * was a segmented pair of buttons, both modes on the bar, but beside the
 * masthead's other controls the pair broke onto two lines on a laptop; the
 * screen itself already shows which mode is in use. The word stays beside
 * the icon: a grid reads as "table", but nothing reads as "guided", and
 * this choice decides how a respondent enters statistical data, so it must
 * not become hover-only. The verb is in the word so the button is read as
 * an action, never mistaken for the mode in use.
 */

interface EntryModeSlot {
  element: HTMLElement | null;
  /** The only registered slot allowed to draw the control. */
  claimantId: string | null;
  register: (id: string) => void;
  unregister: (id: string) => void;
}

/**
 * null means no wizard provides a slot, which is not the same as a
 * provider whose row has not been measured yet: the first tells the switch
 * to render where it stands, the second to wait one commit rather than
 * flash in place and jump.
 */
const EntryModeSlotContext = createContext<EntryModeSlot | null>(null);

export function EntryModeSlotProvider({
  element,
  children,
}: {
  element: HTMLElement | null;
  children: ReactNode;
}) {
  const [ids, setIds] = useState<readonly string[]>([]);
  const register = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const unregister = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev));
  }, []);
  const value = useMemo<EntryModeSlot>(
    () => ({ element, claimantId: ids[0] ?? null, register, unregister }),
    [element, ids, register, unregister],
  );
  return <EntryModeSlotContext.Provider value={value}>{children}</EntryModeSlotContext.Provider>;
}

/**
 * The app bar's slot: empty, and taking no room, until a screen below
 * offers the choice. Returns the element to provide and the node to render
 * in the bar.
 */
export function useEntryModeSlot(): { element: HTMLElement | null; row: ReactNode } {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return { element, row: <div ref={setElement} className="cam-entry-mode-slot" /> };
}

/** Puts the one switch in the app bar, or renders in place without a slot. */
export function EntryModeSwitchSlot(props: {
  mode: "grid" | "guided";
  onChange: (mode: "grid" | "guided") => void;
}) {
  const slot = useContext(EntryModeSlotContext);
  const id = useId();
  const register = slot?.register;
  const unregister = slot?.unregister;
  // A phone has one mode, so it is told rather than asked (use-entry-mode).
  const phone = useIsPhoneViewport();

  useEffect(() => {
    if (!register || !unregister) return;
    register(id);
    return () => unregister(id);
  }, [register, unregister, id]);

  if (phone) return null;
  if (!slot) return <EntryModeSwitch {...props} />;
  // Not this screen's first table, or the bar has not been measured yet.
  if (slot.claimantId !== id || !slot.element) return null;
  return createPortal(<EntryModeSwitch {...props} />, slot.element);
}

export function EntryModeSwitch({
  mode,
  onChange,
}: {
  mode: "grid" | "guided";
  onChange: (mode: "grid" | "guided") => void;
}) {
  const t = useTranslations("modernJobs.entryMode");
  const next = mode === "grid" ? "guided" : "grid";
  return (
    <button type="button" className="cam-mode-switch cam-hoverable" onClick={() => onChange(next)}>
      {/* The icon of the mode it leads to: the grid of cells for Tableau,
          the single card answered one at a time for Guidé. */}
      {next === "grid" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 9h8M8 14h5" />
        </svg>
      )}
      {t(next === "grid" ? "toGrid" : "toGuided")}
    </button>
  );
}
