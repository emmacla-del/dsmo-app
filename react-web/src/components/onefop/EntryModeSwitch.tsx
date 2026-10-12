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
 * It is a select rather than a segmented control: the chosen mode shows,
 * the other appears on click, and a native control carries its own
 * keyboard and screen-reader behaviour.
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
    <div className="cam-mode-switch">
      {/* No visible label: in the app bar it wrapped to three lines beside
          the control. The name is still on the control itself. */}
      <select
        aria-label={t("ariaLabel")}
        value={mode}
        onChange={(event) => onChange(event.target.value === "guided" ? "guided" : "grid")}
      >
        <option value="grid">{t("grid")}</option>
        <option value="guided">{t("guided")}</option>
      </select>
    </div>
  );
}
