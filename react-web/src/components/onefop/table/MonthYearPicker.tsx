"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { localized } from "@/lib/onefop-schema";
import {
  ACTIVITY_MONTHS,
  activityYearOptions,
  joinStartDate,
  splitStartDate,
} from "@/lib/onefop-activities";

/**
 * One box for a month and a year — « Date de début » asks for nothing else.
 *
 * It is not <input type="date">: that makes the respondent pick a day the
 * form does not ask for and the dataset does not hold. It is not
 * <input type="month"> either: that leaves the year behind an arrow, one
 * click per year. And it is not two boxes side by side, which is what this
 * replaced — the cell reads as one control, and opens a panel holding the
 * year (a list, most recent first) over the twelve months.
 *
 * What is stored never changes shape: MM/AAAA, composed here.
 *
 * The panel is portalled to the body and positioned from the box's own
 * rectangle, because the table scrolls sideways and anything absolutely
 * positioned inside it is clipped by that scroll container.
 */
export function MonthYearPicker({
  id,
  value,
  onChange,
  label,
  invalid = false,
  referenceYear,
  locale,
  className,
  style,
}: {
  id: string;
  /** The stored answer: "MM/AAAA", a half of one, or "". */
  value: string;
  onChange: (next: string) => void;
  /** The cell's accessible name — the box and the panel both carry it. */
  label: string;
  invalid?: boolean;
  /** The round's year: the list offers it, the next one, and forty back. */
  referenceYear: number;
  locale: "fr" | "en";
  className?: string;
  style?: React.CSSProperties;
}) {
  const isEn = locale === "en";
  const { month, year } = splitStartDate(value);
  const [open, setOpen] = useState(false);
  const [panelYear, setPanelYear] = useState(year);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const boxRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const monthName = ACTIVITY_MONTHS.find((m) => m.value === month);
  // The box reads as what it holds and what it asks for: MM/AAAA, the form's
  // own shape and the shape of the stored answer. A half of one is not an
  // answer — validation refuses it and no submitted file carries it — so a
  // month with no year ("10/", left by the two-box version this replaced)
  // reads as the placeholder, not as « 10 » or « Octobre », which would look
  // finished. Nothing is erased: the panel still opens, and picking there
  // writes both halves at once.
  const shown =
    monthName && /^\d{4}$/.test(year) ? (
      `${monthName.value}/${year}`
    ) : (
      <span style={{ color: "var(--cam-table-muted)" }}>{isEn ? "MM/YYYY" : "MM/AAAA"}</span>
    );

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) boxRef.current?.focus();
  }, []);

  const openPanel = () => {
    const box = boxRef.current?.getBoundingClientRect();
    setRect(box ? { top: box.bottom + 4, left: box.left } : { top: 0, left: 0 });
    setPanelYear(year || String(referenceYear));
    setOpen(true);
  };

  // Escape closes and gives the box its focus back; a click outside, or the
  // table scrolling under the panel, closes it where it stands.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || boxRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, close]);

  const pick = (monthValue: string) => {
    onChange(joinStartDate(monthValue, panelYear || String(referenceYear)));
    close();
  };

  const panel = open && rect ? (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      id={panelId}
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left,
        zIndex: 60,
        width: 268,
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-border-strong)",
        borderRadius: "var(--cam-radius-control)",
        boxShadow: "var(--cam-shadow-md, 0 6px 16px rgba(20, 30, 20, 0.12))",
        padding: "var(--cam-space-3)",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cam-space-2)",
          marginBottom: "var(--cam-space-3)",
          fontSize: "var(--cam-font-size-xs)",
          color: "var(--cam-text-muted)",
        }}
      >
        {isEn ? "Year" : "Année"}
        <select
          autoFocus
          aria-label={`${label} — ${isEn ? "year" : "année"}`}
          value={panelYear || String(referenceYear)}
          // Changing the year is an answer on its own once the month is
          // there: it is stored as it is picked, so a respondent correcting
          // only the year does not have to click the month again to keep it.
          onChange={(e) => {
            setPanelYear(e.target.value);
            if (month) onChange(joinStartDate(month, e.target.value));
          }}
          style={{
            flex: 1,
            height: 32,
            padding: "0 var(--cam-space-2)",
            border: "1px solid var(--cam-border-strong)",
            borderRadius: "var(--cam-radius-sm)",
            background: "var(--cam-surface)",
            color: "var(--cam-text)",
            fontSize: "var(--cam-answer-size)",
          }}
        >
          {activityYearOptions(referenceYear, year).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--cam-space-1)" }}>
        {ACTIVITY_MONTHS.map((m) => {
          const chosen = m.value === month && (panelYear || String(referenceYear)) === year;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => pick(m.value)}
              aria-pressed={chosen}
              className="cam-hoverable"
              style={{
                padding: "6px 4px",
                fontSize: "var(--cam-font-size-xs)",
                border: "1px solid",
                borderColor: chosen ? "var(--cam-green)" : "transparent",
                borderRadius: "var(--cam-radius-sm)",
                background: chosen ? "var(--cam-success-bg)" : "transparent",
                color: chosen ? "var(--cam-green)" : "var(--cam-text)",
                cursor: "pointer",
              }}
            >
              {localized(m.label, locale)}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={boxRef}
        id={id}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        // aria-invalid says nothing on a button, so the state is in the name
        // the respondent hears and on the box they see (data-invalid, drawn by
        // the same rule as every other owed cell — globals.css).
        aria-label={invalid ? `${label}, ${isEn ? "still to fill" : "à renseigner"}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-invalid={invalid ? "true" : undefined}
        className={className}
        style={{ textAlign: "center", cursor: "pointer", ...style }}
      >
        {shown}
      </button>
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </>
  );
}
