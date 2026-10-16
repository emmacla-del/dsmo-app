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
 * It is a segmented control of two toggle buttons, each an icon and its
 * word (owner, 2026-10-12). It was a native select between 2026-10-11 and
 * then, for the keyboard and screen-reader behaviour a native control
 * brings; two buttons keep that much — each is a real button, named, and
 * reachable by Tab — and in exchange both modes are on the bar instead of
 * one being hidden until the select opens. The word stays beside each
 * icon: a grid reads as "table", but nothing reads as "guided", and this
 * choice decides how a respondent enters statistical data, so it must not
 * become hover-only.
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

  useEffect(() => {
    if (!register || !unregister) return;
    register(id);
    return () => unregister(id);
  }, [register, unregister, id]);

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
  return (
    /* No visible label: in the app bar it wrapped to three lines beside the
       control. "Mode de saisie" names the group for a screen reader, which
       then reads each button as the pressed or unpressed mode. */
    <div className="cam-mode-switch" role="group" aria-label={t("ariaLabel")}>
      {(["grid", "guided"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          {/* Tableau is the grid of cells; Guidé is the single card the
              respondent answers one of at a time. The pair only has to
              differ at 14px — the word carries the meaning. */}
          {value === "grid" ? (
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
          {t(value)}
        </button>
      ))}
    </div>
  );
}
