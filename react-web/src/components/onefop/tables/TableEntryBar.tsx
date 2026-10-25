"use client";

/**
 * The quiet line under a statistical grid: what is left to fill, the way to
 * the next empty cell, the two bulk actions with their undo, and the
 * respondent's own check total.
 *
 * It lives outside StatisticalGridRenderer because none of it is table
 * typography — it is a note beside the table, not a row of it, and the
 * renderer's DataTable guard rightly keeps raw inputs out of the grid itself.
 *
 * §8: one line of text and text actions. No card, no container, no border
 * around them.
 */
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

export interface TableCheckTotal {
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  /** The table's own calculated grand total, or null while it is incomplete. */
  grandTotal: number | null;
  /** False when the figure typed is not a whole number. */
  valid: boolean;
  /** Expected minus calculated, or null when either side is missing. */
  gap: number | null;
}

export interface TableEntryBarProps {
  /** Cells the respondent can type into that are still blank. */
  blanks: number;
  /** Cells the respondent can type into at all. */
  typedCells: number;
  onGoToFirstBlank: () => void;
  /** Rows carrying no figure at all, which the fill action would zero. */
  zeroRows: number;
  onZeroEmptyRows: () => void;
  /** Undoes the last bulk change; absent when there is none to undo. */
  onUndo?: () => void;
  /** The result of the last bulk change, announced as well as shown. */
  notice: string | null;
  checkTotal?: TableCheckTotal;
  /** Read-only table: the bar reports, and offers nothing. */
  disabled?: boolean;
}

const barStyle: CSSProperties = {
  fontSize: "var(--cam-font-size-xs, 0.8125rem)",
  color: "var(--cam-text-muted)",
};

const textAction: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  color: "var(--cam-green)",
  textDecoration: "underline",
  cursor: "pointer",
};

const checkField: CSSProperties = {
  width: 88,
  height: 32,
  padding: "0 8px",
  font: "inherit",
  color: "var(--cam-text)",
  background: "var(--cam-surface)",
  border: "1px solid var(--cam-border)",
  borderRadius: "var(--cam-radius-sm, 3px)",
};

export function TableEntryBar({
  blanks,
  typedCells,
  onGoToFirstBlank,
  zeroRows,
  onZeroEmptyRows,
  onUndo,
  notice,
  checkTotal,
  disabled = false,
}: TableEntryBarProps) {
  const t = useTranslations("modernJobs.grid");
  const gapShown = checkTotal && checkTotal.value.trim() !== "";
  const offTarget = Boolean(
    checkTotal && (!checkTotal.valid || (checkTotal.gap !== null && checkTotal.gap !== 0)),
  );

  return (
    <div className="mt-2 flex flex-col gap-1.5" style={barStyle}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          {blanks === 0 ? t("allCellsFilled") : t("blanksRemaining", { count: blanks, total: typedCells })}
        </span>
        {blanks > 0 && !disabled && (
          <button type="button" style={textAction} onClick={onGoToFirstBlank}>
            {t("goToFirstBlank")}
          </button>
        )}
        {zeroRows > 0 && !disabled && (
          <button type="button" style={textAction} onClick={onZeroEmptyRows}>
            {t("zeroEmptyRows", { count: zeroRows })}
          </button>
        )}
        {onUndo && !disabled && (
          <button type="button" style={textAction} onClick={onUndo}>
            {t("undoBulk")}
          </button>
        )}
      </div>

      {/* A bulk result is announced, not only shown. */}
      <p role="status" aria-live="polite" className={notice ? undefined : "sr-only"}>
        {notice ?? ""}
      </p>

      {/* Said once, while there is nothing in the table to lose: figures that
          already exist in a spreadsheet need not be retyped. */}
      {typedCells > 0 && blanks === typedCells && !disabled && <p>{t("pasteHint")}</p>}

      {checkTotal && !disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={checkTotal.inputId}>{t("checkTotalLabel")}</label>
          <input
            id={checkTotal.inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={checkTotal.value}
            onChange={(e) => checkTotal.onChange(e.target.value)}
            style={checkField}
          />
          {gapShown && (
            <span style={{ color: offTarget ? "var(--cam-warning)" : "var(--cam-green)" }}>
              {!checkTotal.valid
                ? t("checkTotalNotWhole")
                : checkTotal.grandTotal === null
                  ? t("checkTotalPending")
                  : checkTotal.gap === 0
                    ? t("checkTotalMatches")
                    : t("checkTotalGap", {
                        gap: Math.abs(checkTotal.gap ?? 0),
                        actual: checkTotal.grandTotal,
                      })}
            </span>
          )}
        </div>
      )}

    </div>
  );
}
