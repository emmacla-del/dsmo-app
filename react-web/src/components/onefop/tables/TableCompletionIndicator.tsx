"use client";

import React from "react";

export interface TableCompletionIndicatorProps {
  missingCount: number;
  onFocusFirstMissing?: () => void;
  locale?: string;
  className?: string;
}

/**
 * TableCompletionIndicator
 *
 * Displays a concise, accessible completion notification for REPORTED matrix tables
 * that have required but unanswered cells. Includes an interaction to locate and
 * focus the first incomplete cell.
 *
 * Excluded automatically when missingCount is 0, or when a table is NONE or NOT_APPLICABLE.
 */
export function TableCompletionIndicator({
  missingCount,
  onFocusFirstMissing,
  locale = "fr",
  className = "",
}: TableCompletionIndicatorProps) {
  if (missingCount <= 0) return null;

  const isEn = locale.startsWith("en");
  const message = isEn
    ? `Table is reported but incomplete. ${missingCount} cell${missingCount > 1 ? "s" : ""} still need a value. Enter 0 if there were no occurrences.`
    : `Le tableau est déclaré renseigné mais incomplet. ${missingCount} cellule(s) doivent encore être renseignée(s). Saisissez 0 s'il n'y a eu aucune occurrence.`;

  const buttonText = isEn
    ? "Go to first incomplete cell"
    : "Aller à la première cellule incomplète";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`table-completion-indicator ${className}`}
      data-testid="table-completion-indicator"
      data-missing-count={missingCount}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "10px 14px",
        background: "var(--cam-amber-bg, #fff8e6)",
        border: "1px solid var(--cam-amber-border, #fcd34d)",
        borderRadius: "var(--cam-radius-sm, 6px)",
        color: "var(--cam-amber-text, #92400e)",
        fontSize: "var(--cam-font-size-xs, 0.8125rem)",
        lineHeight: 1.4,
        marginBottom: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "var(--cam-amber-badge, #fef3c7)",
            color: "var(--cam-amber-text, #b45309)",
            fontWeight: 700,
            fontSize: "12px",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          !
        </span>
        <span style={{ fontWeight: 500 }}>{message}</span>
      </div>

      {onFocusFirstMissing && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFocusFirstMissing();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "5px 10px",
            background: "var(--cam-surface)",
            border: "1px solid var(--cam-amber-border, #fcd34d)",
            borderRadius: "var(--cam-radius-xs, 4px)",
            color: "var(--cam-amber-text, #92400e)",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
          className="hover:bg-amber-50 active:scale-95"
        >
          {buttonText} →
        </button>
      )}
    </div>
  );
}
