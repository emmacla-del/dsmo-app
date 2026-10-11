"use client";

import type React from "react";
import { useTranslations } from "next-intl";

/** Tableau / Guidé switch, shared by the Modern Jobs sections and the VT tables. */
export function EntryModeSwitch({
  mode,
  onChange,
}: {
  mode: "grid" | "guided";
  onChange: (mode: "grid" | "guided") => void;
}) {
  const t = useTranslations("modernJobs.entryMode");
  const btn = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: active ? "var(--cam-text)" : "transparent",
    color: active ? "#ffffff" : "var(--cam-text-muted)",
    border: "none",
    borderRadius: "var(--cam-radius-sm)",
    padding: "5px 12px",
    fontSize: "var(--cam-font-size-xs, 0.8125rem)",
    fontWeight: 600,
    fontFamily: "var(--cam-font-sans)",
    cursor: "pointer",
  });
  return (
    <div
      role="group"
      aria-label={t("ariaLabel")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-control, 6px)",
        padding: 2,
      }}
    >
      <button type="button" aria-pressed={mode === "grid"} onClick={() => onChange("grid")} className="cam-hoverable" style={btn(mode === "grid")}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
        {t("grid")}
      </button>
      <button type="button" aria-pressed={mode === "guided"} onClick={() => onChange("guided")} className="cam-hoverable" style={btn(mode === "guided")}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
        </svg>
        {t("guided")}
      </button>
    </div>
  );
}
