"use client";

import React, { type KeyboardEvent } from "react";
import { useLocale } from "next-intl";
import type { FormData } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import type {
  FixedMatrixDefinition,
} from "./StatisticalTableDefinition";

export interface LiveTablePreviewProps {
  definition: FixedMatrixDefinition;
  data: FormData;
  highlightFieldKeys?: string[];
  editableFieldKeys?: string[];
  unansweredFieldKeys?: string[];
  unansweredCount?: number;
  canConfirm?: boolean;
  onCollapse?: () => void;
  className?: string;
  isConfirmationView?: boolean;
  onConfirmProceed?: () => void;
  onReturnToQuestions?: () => void;
  onEditField?: (fieldKey: string) => void;
}

/**
 * Read-only summary of a statistical matrix. In Mode Guidé this mounts only
 * after the respondent finishes the questions (confirmation / recap).
 */
export function LiveTablePreview({
  definition,
  data,
  highlightFieldKeys = [],
  editableFieldKeys,
  unansweredFieldKeys = [],
  unansweredCount = 0,
  canConfirm = true,
  onCollapse,
  className = "",
  isConfirmationView = false,
  onConfirmProceed,
  onReturnToQuestions,
  onEditField,
}: LiveTablePreviewProps) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";

  const highlightSet = new Set(highlightFieldKeys);
  const unansweredSet = new Set(unansweredFieldKeys);
  const editableSet = editableFieldKeys ? new Set(editableFieldKeys) : null;
  const hasHeaderGroups = Boolean(
    definition.headerGroups && definition.headerGroups.length > 0
  );

  const getCellValue = (fieldKey: string): number | null => {
    const raw = data[fieldKey];
    if (raw === undefined || raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  const isEditableKey = (fieldKey: string) =>
    Boolean(onEditField) && (editableSet == null || editableSet.has(fieldKey));

  const firstEditableKeyInRow = (row: (typeof definition.rows)[number]): string | undefined => {
    for (const col of definition.columns) {
      const cellDef = row.cells[col.key];
      if (cellDef && isEditableKey(cellDef.fieldKey)) return cellDef.fieldKey;
    }
    return undefined;
  };

  const activateField = (fieldKey: string) => {
    onEditField?.(fieldKey);
  };

  const handleCellKeyDown = (e: KeyboardEvent<HTMLTableCellElement>, fieldKey: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activateField(fieldKey);
    }
  };

  const summaryTitle =
    (definition.caption ? localized(definition.caption, locale) : null) ||
    localized(definition.title, locale);

  return (
    <div
      className={`bg-white border border-[var(--cam-border)] rounded-[6px] shadow-xs flex flex-col font-sans transition-all overflow-hidden ${className}`}
      data-testid={`live-table-preview-${definition.id}`}
    >
      {!isConfirmationView && (
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--cam-bg)] border-b border-[var(--cam-border)] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[var(--cam-text)] truncate">
                  {locale === "en" ? "Live Table Preview" : "Aperçu en direct du tableau"}
                </span>
                {definition.paperCode && (
                  <span className="text-[10px] font-[family-name:var(--cam-font-mono)] px-1.5 py-0.2 rounded bg-white border border-[var(--cam-border)] text-[var(--cam-text-muted)]">
                    {definition.paperCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--cam-text-muted)] truncate">
                {locale === "en"
                  ? "Active cells update in real-time as you answer."
                  : "Les cellules s'actualisent en direct au fil de vos réponses."}
              </p>
            </div>
          </div>

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="px-2.5 py-1 text-xs font-semibold text-[var(--cam-text-muted)] hover:text-[var(--cam-text)] bg-white border border-[var(--cam-border)] hover:bg-[var(--cam-surface-subtle)] rounded-[3px] transition-colors cursor-pointer shrink-0 flex items-center gap-1"
              title={locale === "en" ? "Hide live preview" : "Masquer l'aperçu du tableau"}
            >
              <span>✕</span>
              <span className="hidden sm:inline">{locale === "en" ? "Hide table" : "Masquer"}</span>
            </button>
          )}
        </div>
      )}

      {isConfirmationView && unansweredCount > 0 && (
        <div
          role="status"
          className="px-4 py-2.5 bg-[var(--cam-warning-bg)] border-b border-[var(--cam-warning-border)] text-xs font-semibold text-[var(--cam-warning)]"
        >
          {locale === "en"
            ? `${unansweredCount} answer${unansweredCount > 1 ? "s" : ""} still to complete — click an empty cell to return to that question.`
            : `${unansweredCount} réponse${unansweredCount > 1 ? "s" : ""} à compléter — cliquez une case vide pour y revenir.`}
        </div>
      )}

      {isConfirmationView && onEditField && unansweredCount === 0 && (
        <p className="px-4 py-2 text-[11px] text-[var(--cam-text-muted)] border-b border-[var(--cam-border)]">
          {locale === "en"
            ? "Click a figure to change that answer."
            : "Cliquez un chiffre pour modifier cette réponse."}
        </p>
      )}

      <div className="w-full overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin">
        <table className="w-full border-collapse text-xs">
          <thead>
            {hasHeaderGroups && (
              <tr className="bg-[var(--cam-surface-subtle)] border-b border-[var(--cam-border)]">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-[var(--cam-surface-subtle)] px-3 py-2 text-left font-bold text-[var(--cam-text)] border-r border-[var(--cam-border)] min-w-[140px]"
                >
                  {localized(definition.rowHeaderLabel, locale)}
                </th>
                {definition.headerGroups!.map((grp, idx) => (
                  <th
                    key={idx}
                    colSpan={grp.colSpan}
                    className="px-2.5 py-1.5 text-center font-bold text-[var(--cam-green)] border-r border-[var(--cam-border)] uppercase text-[10.5px] tracking-wider"
                  >
                    {localized(grp.title, locale)}
                  </th>
                ))}
              </tr>
            )}

            <tr className="bg-[var(--cam-bg)] border-b border-[var(--cam-border)]">
              {!hasHeaderGroups && (
                <th className="sticky left-0 z-20 bg-[var(--cam-bg)] px-3 py-2 text-left font-bold text-[var(--cam-text)] border-r border-[var(--cam-border)] min-w-[140px]">
                  {localized(definition.rowHeaderLabel, locale)}
                </th>
              )}
              {definition.columns.map((col) => {
                const isColComputed = col.kind === "computed";
                return (
                  <th
                    key={col.key}
                    className={`px-2 py-1.5 text-center font-semibold text-[var(--cam-text)] border-r border-[var(--cam-border)] min-w-[70px] ${
                      isColComputed ? "bg-[var(--cam-success-bg)] text-[var(--cam-green)] font-bold" : ""
                    }`}
                  >
                    {localized(col.header, locale)}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {definition.rows.map((row) => {
              const isTotal = Boolean(row.isTotal);
              const isSubtotal = Boolean(row.isSubtotal);
              const rowEditKey = !isTotal && !isSubtotal ? firstEditableKeyInRow(row) : undefined;

              return (
                <tr
                  key={row.id}
                  className={`border-b transition-colors ${
                    isTotal
                      ? "bg-[var(--cam-success-bg)] font-bold border-[var(--cam-success-border)]"
                      : isSubtotal
                      ? "bg-[var(--cam-bg)] font-semibold border-[var(--cam-border)]"
                      : "hover:bg-[var(--cam-bg)] border-[var(--cam-border)]"
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 px-3 py-2 text-left border-r border-[var(--cam-border)] truncate max-w-[200px] ${
                      isTotal
                        ? "bg-[var(--cam-success-bg)] text-[var(--cam-green)] font-bold"
                        : isSubtotal
                        ? "bg-[var(--cam-bg)] text-[var(--cam-text)] font-semibold"
                        : "bg-white text-[var(--cam-text)]"
                    } ${rowEditKey ? "cursor-pointer" : ""}`}
                    title={localized(row.label, locale)}
                    onClick={rowEditKey ? () => activateField(rowEditKey) : undefined}
                  >
                    {localized(row.label, locale)}
                  </td>

                  {definition.columns.map((col) => {
                    const cellDef = row.cells[col.key];
                    if (!cellDef) {
                      return (
                        <td
                          key={col.key}
                          className="px-2 py-1.5 text-center border-r border-[var(--cam-border)] text-[var(--cam-text-muted)]"
                        >
                          —
                        </td>
                      );
                    }

                    const val = getCellValue(cellDef.fieldKey);
                    const isCellActive = highlightSet.has(cellDef.fieldKey);
                    const isUnanswered = unansweredSet.has(cellDef.fieldKey);
                    const isComputed = cellDef.kind === "computed" || isTotal;
                    const canEdit = !isTotal && !isSubtotal && isEditableKey(cellDef.fieldKey);
                    const display =
                      val != null ? val.toLocaleString() : "—";

                    return (
                      <td
                        key={col.key}
                        onClick={canEdit ? () => activateField(cellDef.fieldKey) : undefined}
                        onKeyDown={canEdit ? (e) => handleCellKeyDown(e, cellDef.fieldKey) : undefined}
                        role={canEdit ? "button" : undefined}
                        tabIndex={canEdit ? 0 : undefined}
                        title={
                          canEdit
                            ? locale === "en"
                              ? "Edit this answer"
                              : "Modifier cette réponse"
                            : undefined
                        }
                        className={`px-2 py-1.5 text-center text-xs tabular-nums border-r border-[var(--cam-border)] transition-colors ${
                          canEdit ? "cursor-pointer hover:bg-[var(--cam-warning-bg)]" : ""
                        } ${
                          isUnanswered
                            ? "bg-[var(--cam-warning-bg)] text-[var(--cam-warning)] font-bold ring-1 ring-inset ring-[var(--cam-warning-border)]"
                            : isCellActive
                            ? "bg-[var(--cam-warning-bg)] text-[var(--cam-text)] font-bold ring-2 ring-[var(--cam-green)] ring-inset"
                            : isComputed
                            ? "bg-[var(--cam-success-bg)] text-[var(--cam-green)] font-bold"
                            : val != null && val > 0
                            ? "text-[var(--cam-text)] font-semibold bg-white"
                            : "text-[var(--cam-text-muted)] bg-white"
                        }`}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isConfirmationView && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[var(--cam-bg)] border-t border-[var(--cam-border)]">
          {onReturnToQuestions && (
            <button
              type="button"
              onClick={onReturnToQuestions}
              className="px-3.5 py-2 text-xs font-semibold text-[var(--cam-text-muted)] bg-white border border-[var(--cam-border)] hover:bg-[var(--cam-surface-subtle)] rounded-[3px] transition-colors cursor-pointer"
            >
              {locale === "en" ? "← Edit answers" : "← Modifier une réponse"}
            </button>
          )}

          {onConfirmProceed && (
            <button
              type="button"
              onClick={onConfirmProceed}
              disabled={!canConfirm}
              className="px-5 py-2 text-xs font-bold text-white bg-[var(--cam-green)] hover:bg-[var(--cam-green-dark)] rounded-[3px] shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--cam-green)]"
            >
              <span>
                {locale === "en" ? "Confirm and continue →" : "Confirmer et continuer →"}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
