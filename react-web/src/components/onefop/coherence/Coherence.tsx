"use client";

/**
 * Coherence anomalies in the tables (non-blocking arithmetic checks from
 * lib/onefop-coherence.ts), presented where the numbers are:
 *
 * - every cell involved in an anomaly is marked (warning tint + corner mark);
 * - hovering, focusing, clicking or tapping the cell opens a tooltip with a
 *   plain-language explanation, buttons to jump to the other table(s)
 *   involved, and "C'est correct" to dismiss it;
 * - a chip above each affected table ("● 1 anomalie à vérifier") makes the
 *   anomaly discoverable without hovering and opens the same tooltip;
 * - the review step lists every remaining anomaly (CoherenceReviewList).
 *
 * Anomalies never block submission (CLAUDE.md §7). "C'est correct" only
 * hides the hint for this browser session — it is not stored with the
 * declaration, and the server still computes its own flags at submit time.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  COHERENCE_TABLE_LABELS,
  type CoherenceCell,
  type CoherenceFlag,
} from "@/lib/onefop-coherence";

type Locale = "fr" | "en";

interface FocusRequest {
  cell: CoherenceCell;
  open: boolean;
  nonce: number;
}

interface CoherenceContextValue {
  locale: Locale;
  /** Active (not dismissed) anomalies. */
  flags: CoherenceFlag[];
  dismiss: (flagKey: string) => void;
  flagsForCell: (fieldKey: string) => CoherenceFlag[];
  flagsForTable: (tableFieldId: string) => CoherenceFlag[];
  /** Bring a cell into view (switching section / table / block as needed), optionally opening its tooltip. */
  focusCell: (cell: CoherenceCell, open?: boolean) => void;
  focusRequest: FocusRequest | null;
  /** The wizard registers how to show a given table (section + deck position). */
  registerNavigator: (fn: ((tableFieldId: string) => void) | null) => void;
}

const CoherenceContext = createContext<CoherenceContextValue | null>(null);

export function useCoherence(): CoherenceContextValue | null {
  return useContext(CoherenceContext);
}

const sameTable = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function CoherenceProvider({ flags, children }: { flags: CoherenceFlag[]; children: React.ReactNode }) {
  const locale: Locale = useLocale().startsWith("en") ? "en" : "fr";
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const navigatorRef = useRef<((tableFieldId: string) => void) | null>(null);

  const active = useMemo(() => flags.filter((f) => !dismissed.has(f.key)), [flags, dismissed]);

  const dismiss = useCallback((flagKey: string) => {
    setDismissed((prev) => new Set(prev).add(flagKey));
  }, []);

  const flagsForCell = useCallback(
    (fieldKey: string) => active.filter((f) => f.cells.some((c) => c.fieldKey === fieldKey)),
    [active],
  );
  const flagsForTable = useCallback(
    (tableFieldId: string) => active.filter((f) => f.cells.some((c) => sameTable(c.tableFieldId, tableFieldId))),
    [active],
  );

  const registerNavigator = useCallback((fn: ((tableFieldId: string) => void) | null) => {
    navigatorRef.current = fn;
  }, []);

  const focusCell = useCallback((cell: CoherenceCell, open = false) => {
    navigatorRef.current?.(cell.tableFieldId);
    setFocusRequest({ cell, open, nonce: Date.now() });
  }, []);

  // After navigation has re-rendered, find the cell and bring it into view.
  // Polls briefly because switching section / table deck / block tab
  // renders the target cell a frame or two later.
  useEffect(() => {
    if (!focusRequest) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      const el =
        document.querySelector<HTMLElement>(`[data-coherence-cell="${CSS.escape(focusRequest.cell.fieldKey)}"]`) ??
        document.getElementById(focusRequest.cell.fieldKey);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.animate?.(
          [
            { boxShadow: "inset 0 0 0 2px var(--cam-warning), 0 0 0 0 rgba(184,124,20,0.45)" },
            { boxShadow: "inset 0 0 0 2px var(--cam-warning), 0 0 0 6px rgba(184,124,20,0)" },
          ],
          { duration: 700, iterations: 2 },
        );
        if (focusRequest.open) {
          const target = el.querySelector<HTMLElement>("input") ?? el;
          target.focus({ preventScroll: true });
        }
        return;
      }
      if (tries++ < 15) timer = setTimeout(attempt, 100);
    };
    timer = setTimeout(attempt, 60);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  const value = useMemo<CoherenceContextValue>(
    () => ({ locale, flags: active, dismiss, flagsForCell, flagsForTable, focusCell, focusRequest, registerNavigator }),
    [locale, active, dismiss, flagsForCell, flagsForTable, focusCell, focusRequest, registerNavigator],
  );

  return <CoherenceContext.Provider value={value}>{children}</CoherenceContext.Provider>;
}

// ── Shared visuals ─────────────────────────────────────────────────────────

/** Style added to a table cell taking part in an anomaly. */
export const ANOMALY_CELL_STYLE: React.CSSProperties = {
  position: "relative",
  background: "var(--cam-warning-bg)",
  color: "var(--cam-warning)",
  boxShadow: "inset 0 0 0 2px var(--cam-warning)",
  cursor: "help",
};

function CornerMark() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        borderTop: "9px solid var(--cam-warning)",
        borderRight: "9px solid transparent",
        pointerEvents: "none",
      }}
    />
  );
}

const tipButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: "var(--cam-font-size-3xs)",
  fontWeight: 600,
  fontFamily: "var(--cam-font-sans)",
  color: "var(--cam-warning)",
  background: "var(--cam-surface)",
  border: "1px solid var(--cam-warning)",
  borderRadius: "var(--cam-radius-sm)",
  cursor: "pointer",
};

const tipLinkStyle: React.CSSProperties = {
  padding: "4px 2px",
  fontSize: "var(--cam-font-size-3xs)",
  fontWeight: 600,
  fontFamily: "var(--cam-font-sans)",
  color: "var(--cam-text-muted)",
  background: "none",
  border: "none",
  textDecoration: "underline",
  cursor: "pointer",
};

/** Title + explanation + actions for one anomaly (used in tooltips, notes and the review list). */
function AnomalyBody({
  flag,
  currentTableFieldId,
  onAction,
  compact = false,
}: {
  flag: CoherenceFlag;
  currentTableFieldId?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const ctx = useCoherence();
  const t = useTranslations("modernJobs.coherence");
  if (!ctx) return null;
  const { locale } = ctx;
  // One "see" button per other table involved (the current table's own cell
  // is already right there).
  const others = flag.cells.filter(
    (c, i, all) =>
      (!currentTableFieldId || !sameTable(c.tableFieldId, currentTableFieldId)) &&
      all.findIndex((x) => sameTable(x.tableFieldId, c.tableFieldId)) === i,
  );
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: "var(--cam-font-size-xs)", color: "var(--cam-warning)", marginBottom: 4 }}>
        {flag.title[locale]}
      </div>
      <p style={{ margin: "0 0 6px", fontSize: "var(--cam-font-size-xs)", lineHeight: 1.45, color: "var(--cam-text)" }}>
        {flag.message[locale]}
      </p>
      {!compact && (
        <p style={{ margin: "0 0 8px", fontSize: "var(--cam-font-size-3xs)", lineHeight: 1.45, color: "var(--cam-text-muted)" }}>
          {flag.why[locale]}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {others.map((cell) => {
          const label = COHERENCE_TABLE_LABELS[cell.tableFieldId];
          if (!label) return null;
          return (
            <button
              key={cell.tableFieldId}
              type="button"
              style={tipButtonStyle}
              onClick={() => {
                onAction?.();
                ctx.focusCell(cell, false);
              }}
            >
              {t("see")}
              {label[locale]}
            </button>
          );
        })}
        <button
          type="button"
          style={tipLinkStyle}
          onClick={() => {
            onAction?.();
            ctx.dismiss(flag.key);
          }}
        >
          {t("thisIsCorrect")}
        </button>
      </div>
    </div>
  );
}

/** Floating tooltip anchored to an element, rendered in a portal so table overflow can't clip it. */
function AnomalyTooltip({
  id,
  anchor,
  flags,
  currentTableFieldId,
  onPointerEnter,
  onPointerLeave,
  onClose,
}: {
  id: string;
  anchor: HTMLElement;
  flags: CoherenceFlag[];
  currentTableFieldId?: string;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClose: () => void;
}) {
  const ctx = useCoherence();
  const t = useTranslations("modernJobs.coherence");
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const width = 320;
      const height = tipRef.current?.offsetHeight ?? 180;
      const spaceBelow = window.innerHeight - r.bottom;
      const above = spaceBelow < height + 16 && r.top > height + 16;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: above ? r.top - height - 8 : r.bottom + 8, left, above });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, flags.length]);

  if (!ctx || typeof document === "undefined") return null;
  return createPortal(
    <div
      id={id}
      ref={tipRef}
      role="dialog"
      aria-label={t("figureToCheck")}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
          anchor.focus();
        }
      }}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: 320,
        zIndex: 1000,
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-warning-border)",
        borderTop: "4px solid var(--cam-warning)",
        borderRadius: "var(--cam-radius-sm)",
        boxShadow: "0 8px 24px rgba(20, 30, 20, 0.18)",
        padding: "10px 12px",
        fontFamily: "var(--cam-font-sans)",
        textAlign: "left",
        whiteSpace: "normal",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {flags.map((flag) => (
          <AnomalyBody key={flag.key} flag={flag} currentTableFieldId={currentTableFieldId} onAction={onClose} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** Open/close behaviour shared by cells and chips: hover, focus, click/tap, Enter, Escape. */
function useTooltipState() {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const hideSoon = useCallback(() => {
    if (pinned.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);
  const close = useCallback(() => {
    pinned.current = false;
    clearTimeout(closeTimer.current);
    setOpen(false);
  }, []);
  const pin = useCallback(() => {
    pinned.current = true;
    show();
  }, [show]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  return { open, show, hideSoon, close, pin, pinned };
}

type TdProps = React.TdHTMLAttributes<HTMLTableCellElement>;

/**
 * Drop-in replacement for a statistical table's `<td>`: identical when the
 * cell has no anomaly; otherwise tinted, marked, and tooltip-enabled.
 * `fieldKey` is the FormData key of the value shown in the cell.
 */
export function CoherenceTd({
  fieldKey,
  tableFieldId,
  hasInput = false,
  style,
  children,
  ...rest
}: TdProps & {
  fieldKey?: string;
  tableFieldId?: string;
  /** True when the cell contains an editable input (which provides focus itself). */
  hasInput?: boolean;
}) {
  const ctx = useCoherence();
  const t = useTranslations("modernJobs.coherence");
  const flags = fieldKey && ctx ? ctx.flagsForCell(fieldKey) : [];
  const tipId = useId();
  // State (not a ref) so the tooltip can anchor to it during render.
  const [tdEl, setTdEl] = useState<HTMLTableCellElement | null>(null);
  const tip = useTooltipState();

  // Close if the anomaly disappears (value corrected / dismissed).
  const active = flags.length > 0;
  const { close } = tip;
  useEffect(() => {
    if (!active) close();
  }, [active, close]);

  // A "see this cell"/chip request targeting this cell opens it pinned.
  const req = ctx?.focusRequest;
  const { pin } = tip;
  useEffect(() => {
    if (active && req?.open && req.cell.fieldKey === fieldKey) pin();
  }, [active, req, fieldKey, pin]);

  if (!active) {
    return (
      <td {...rest} style={style} data-coherence-cell={fieldKey}>
        {children}
      </td>
    );
  }

  const label = t("figureToCheck");
  return (
    <td
      {...rest}
      ref={setTdEl}
      data-coherence-cell={fieldKey}
      // Read-only cells become focusable so keyboard users can open the
      // tooltip; cells with an input use the input's own focus.
      tabIndex={rest.tabIndex ?? (hasInput ? undefined : 0)}
      aria-describedby={tip.open ? tipId : undefined}
      title={undefined}
      style={{ ...style, ...ANOMALY_CELL_STYLE }}
      onPointerEnter={(e) => {
        rest.onPointerEnter?.(e);
        tip.show();
      }}
      onPointerLeave={(e) => {
        rest.onPointerLeave?.(e);
        tip.hideSoon();
      }}
      onFocus={(e) => {
        rest.onFocus?.(e);
        tip.show();
      }}
      onBlur={(e) => {
        rest.onBlur?.(e);
        const next = e.relatedTarget as Node | null;
        if (next && document.getElementById(tipId)?.contains(next)) return;
        tip.close();
      }}
      onClick={(e) => {
        rest.onClick?.(e);
        if ((e.target as HTMLElement).tagName !== "INPUT") {
          if (tip.pinned.current) tip.close();
          else tip.pin();
        }
      }}
      onKeyDown={(e) => {
        rest.onKeyDown?.(e);
        if (e.key === "Escape") tip.close();
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "INPUT") {
          e.preventDefault();
          tip.pin();
          setTimeout(() => document.getElementById(tipId)?.querySelector("button")?.focus(), 0);
        }
      }}
    >
      <CornerMark />
      <span className="sr-only">{label}</span>
      {children}
      {tip.open && tdEl && (
        <AnomalyTooltip
          id={tipId}
          anchor={tdEl}
          flags={flags}
          currentTableFieldId={tableFieldId}
          onPointerEnter={tip.show}
          onPointerLeave={tip.hideSoon}
          onClose={tip.close}
        />
      )}
    </td>
  );
}

/** "● 1 anomalie à vérifier" above a table; opens the anomalies of that table. */
export function CoherenceChip({ tableFieldId, style }: { tableFieldId?: string; style?: React.CSSProperties }) {
  const ctx = useCoherence();
  const t = useTranslations("modernJobs.coherence");
  const tipId = useId();
  const [chipEl, setChipEl] = useState<HTMLButtonElement | null>(null);
  const tip = useTooltipState();
  const flags = tableFieldId && ctx ? ctx.flagsForTable(tableFieldId) : [];
  const active = flags.length > 0;
  const { close } = tip;
  useEffect(() => {
    if (!active) close();
  }, [active, close]);
  if (!ctx || !active) return null;
  const count = flags.length;
  const text = t("anomaliesToCheck", { count });

  return (
    <>
      <button
        ref={setChipEl}
        type="button"
        aria-expanded={tip.open}
        aria-controls={tip.open ? tipId : undefined}
        onClick={() => {
          if (tip.pinned.current) {
            tip.close();
            return;
          }
          // Point at the first marked cell of this table if it is on screen.
          const cell = flags[0].cells.find((c) => sameTable(c.tableFieldId, tableFieldId!));
          const el = cell && document.querySelector(`[data-coherence-cell="${CSS.escape(cell.fieldKey)}"]`);
          if (cell && el) ctx.focusCell(cell, false);
          tip.pin();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") tip.close();
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          width: "fit-content",
          padding: "3px 10px",
          fontSize: "var(--cam-font-size-3xs)",
          fontWeight: 700,
          fontFamily: "var(--cam-font-sans)",
          color: "var(--cam-warning)",
          background: "var(--cam-warning-bg)",
          border: "1px solid var(--cam-warning-border)",
          borderRadius: "var(--cam-radius-full, 9999px)",
          cursor: "pointer",
          ...style,
        }}
      >
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cam-warning)" }} />
        {text}
      </button>
      {tip.open && chipEl && (
        <AnomalyTooltip
          id={tipId}
          anchor={chipEl}
          flags={flags}
          currentTableFieldId={tableFieldId}
          onPointerEnter={tip.show}
          onPointerLeave={() => undefined}
          onClose={tip.close}
        />
      )}
    </>
  );
}

/** Inline note under a plain (non-table) field that has an anomaly (e.g. implausible headcount). */
export function CoherenceFieldNote({ fieldId }: { fieldId: string }) {
  const ctx = useCoherence();
  const flags = ctx ? ctx.flagsForCell(fieldId) : [];
  if (!ctx || flags.length === 0) return null;
  return (
    <div
      role="status"
      style={{
        marginTop: 6,
        padding: "8px 10px",
        background: "var(--cam-warning-bg)",
        borderLeft: "3px solid var(--cam-warning)",
        borderRadius: "var(--cam-radius-sm)",
      }}
    >
      {flags.map((flag) => (
        <AnomalyBody key={flag.key} flag={flag} currentTableFieldId={fieldId} compact />
      ))}
    </div>
  );
}

/** Review-step list of every remaining anomaly. Never blocks submission. */
export function CoherenceReviewList({ onGoTo }: { onGoTo?: (cell: CoherenceCell) => void }) {
  const ctx = useCoherence();
  const t = useTranslations("modernJobs.coherence");
  if (!ctx || ctx.flags.length === 0) return null;
  const { locale, flags } = ctx;
  const count = flags.length;
  return (
    <section
      aria-labelledby="coherence-review-title"
      style={{
        border: "1px solid var(--cam-warning-border)",
        borderLeft: "4px solid var(--cam-warning)",
        background: "var(--cam-warning-bg)",
        borderRadius: "var(--cam-radius-sm)",
        padding: "12px 14px",
        marginBottom: 20,
      }}
    >
      <h3 id="coherence-review-title" style={{ margin: "0 0 2px", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-warning)" }}>
        {t("pointsToCheck", { count })}
      </h3>
      <p style={{ margin: "0 0 10px", fontSize: "var(--cam-font-size-3xs)", color: "var(--cam-text-muted)" }}>
        {t("reviewIntro")}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {flags.map((flag) => (
          <li
            key={flag.key}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: "10px 0",
              borderTop: "1px solid var(--cam-warning-border)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text)" }}>{flag.title[locale]}</div>
              <div style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text)", lineHeight: 1.45 }}>{flag.message[locale]}</div>
            </div>
            <button
              type="button"
              style={tipButtonStyle}
              onClick={() => {
                const cell = flag.cells[0];
                if (onGoTo) onGoTo(cell);
                else ctx.focusCell(cell, true);
              }}
            >
              {t("correct")}
            </button>
            <button type="button" style={tipLinkStyle} onClick={() => ctx.dismiss(flag.key)}>
              {t("thisIsCorrect")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
