"use client";

import React, { useRef, useEffect, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import type {
  FixedMatrixDefinition,
  StatisticalRowDefinition,
  StatisticalColumnDefinition,
} from "./StatisticalTableDefinition";
import { TABLE_LABEL_COL_PX, TABLE_MAX_WIDTH_PX, tableMinWidthPx } from "./tableLayout";
import { CoherenceTd } from "../coherence/Coherence";
import {
  Cell,
  CellValue,
  CornerHeader,
  DataTable,
  GroupHeader,
  LeafHeader,
  NumberInput,
  RowCode,
  RowHeader,
} from "../table/DataTable";
import { RequiredAsterisk } from "./RequiredAsterisk";

export interface StatisticalGridRendererProps {
  definition: FixedMatrixDefinition;
  data: FormData;
  onChange: (fieldKey: string, value: unknown) => void;
  onBatchChange?: (updates: Record<string, unknown>) => void;
  className?: string;
  disabled?: boolean;
  onAdvanceTable?: () => void;
  onPreviousTable?: () => void;
  autoFocusFirstCell?: boolean;
  /** Schema field id of this table (e.g. "S22Q04"), for coherence anomalies. */
  tableFieldId?: string;
  /** Quiz-kept cells the respondent tried to leave blank. */
  missingFieldKeys?: string[];
}

/**
 * Generic semantic HTML Statistical Table renderer.
 * Features:
 * - Direct cell typing with immediate auto-sums
 * - Multi-tier accessible headers
 * - Sticky first column for horizontal scrolling
 * - Spreadsheet-like arrow and enter keyboard navigation
 * - Visually distinct read-only computed cells and total rows
 */
export function StatisticalGridRenderer({
  definition,
  data,
  onChange,
  onBatchChange,
  className = "",
  disabled = false,
  onAdvanceTable,
  onPreviousTable,
  autoFocusFirstCell = false,
  tableFieldId,
  missingFieldKeys,
}: StatisticalGridRendererProps) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const t = useTranslations("modernJobs.grid");
  const tableRef = useRef<HTMLTableElement>(null);
  const missing = new Set(missingFieldKeys ?? []);
  const columnIsRequired = (colKey: string) =>
    definition.rows.some((row) => !row.isTotal && !row.isSubtotal && row.cells[colKey]?.required);
  const rowIsRequired = (row: { isTotal?: boolean; isSubtotal?: boolean; cells: Record<string, { required?: boolean }> }) =>
    !row.isTotal && !row.isSubtotal && Object.values(row.cells).some((cell) => cell.required);

  // Auto-focus first input when table is displayed / changed in focus deck
  useEffect(() => {
    if (autoFocusFirstCell && tableRef.current) {
      const timer = setTimeout(() => {
        const firstInput = tableRef.current?.querySelector<HTMLInputElement>("tbody input[data-row-idx]");
        if (firstInput) {
          // preventScroll: focusing must not yank the page mid-transition.
          firstInput.focus({ preventScroll: true });
          firstInput.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [definition.id, autoFocusFirstCell]);

  // Group columns by headerGroup if present
  const hasHeaderGroups = Boolean(
    definition.headerGroups && definition.headerGroups.length > 0
  );

  // Helper to get raw cell value
  const getCellValue = (fieldKey: string): number | null => {
    const raw = data[fieldKey];
    if (raw === undefined || raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  // Helper to handle input change
  const handleCellChange = (
    row: StatisticalRowDefinition,
    col: StatisticalColumnDefinition,
    rawVal: string
  ) => {
    const cellDef = row.cells[col.key];
    if (!cellDef || cellDef.kind === "computed") return;

    const numVal = rawVal === "" ? null : Number(rawVal);
    onChange(cellDef.fieldKey, numVal);

    // Auto-compute row siblings if row has a computed cell and table has no definition.recalc
    if (!definition.recalc) {
      const computedCell = Object.values(row.cells).find(
        (c) => c.kind === "computed"
      );
      if (computedCell) {
        // Calculate sum of all number cells in this row
        let rowSum = 0;
        let hasAnyValue = false;

        for (const c of Object.values(row.cells)) {
          if (c.kind === "number") {
            const val =
              c.fieldKey === cellDef.fieldKey
                ? rawVal === ""
                  ? null
                  : Number(rawVal)
                : getCellValue(c.fieldKey);
            if (val != null) {
              rowSum += val;
              hasAnyValue = true;
            }
          }
        }

        onChange(computedCell.fieldKey, hasAnyValue ? rowSum : null);
      }
    }
  };

  // Keyboard navigation within editable grid cells and fluid table advance
  const handleCellKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    const table = tableRef.current;
    if (!table) return;

    // Ctrl+Enter or Cmd+Enter anywhere -> Advance to next table
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onAdvanceTable?.();
      return;
    }

    const allInputs = Array.from(table.querySelectorAll<HTMLInputElement>("tbody input[data-row-idx]"));
    const currentInput = e.currentTarget;
    const currentIndex = allInputs.indexOf(currentInput);

    // Shift + Tab on the very first input -> Go to previous table
    if (e.key === "Tab" && e.shiftKey && currentIndex === 0 && onPreviousTable) {
      e.preventDefault();
      onPreviousTable();
      return;
    }

    // Tab on the very last input -> Advance to next table
    if (e.key === "Tab" && !e.shiftKey && currentIndex === allInputs.length - 1 && onAdvanceTable) {
      e.preventDefault();
      onAdvanceTable();
      return;
    }

    const findInput = (r: number, c: number) =>
      table.querySelector<HTMLInputElement>(
        `input[data-row-idx="${r}"][data-col-idx="${c}"]`
      );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = findInput(rowIdx + 1, colIdx);
      if (next) next.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentIndex >= 0 && currentIndex < allInputs.length - 1) {
        const next = allInputs[currentIndex + 1];
        next?.focus();
        next?.select();
        next?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (currentIndex === allInputs.length - 1 && onAdvanceTable) {
        onAdvanceTable();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = findInput(rowIdx - 1, colIdx);
      if (prev) prev.focus();
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget;
      // Only move right if caret is at the end of the text
      if (input.selectionStart === input.value.length) {
        const right =
          findInput(rowIdx, colIdx + 1) || findInput(rowIdx + 1, 0);
        if (right) {
          e.preventDefault();
          right.focus();
        }
      }
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget;
      // Only move left if caret is at the start
      if (input.selectionStart === 0) {
        const left = findInput(rowIdx, colIdx - 1);
        if (left) {
          e.preventDefault();
          left.focus();
        }
      }
    }
  };

  // Separate body rows from total row (if defined in rows with isTotal)
  const totalRow = definition.rows.find((r) => r.isTotal);
  const bodyRows = totalRow
    ? definition.rows.filter((r) => !r.isTotal)
    : definition.rows;

  // Footer of a table with `hasTotalRow` but no stored total row (VT 4.1):
  // the column's sum over the body rows, display only. Blank while any of
  // those cells is blank, like the row totals (a missing cell is not 0).
  const columnSum = (colKey: string): number | null => {
    let sum = 0;
    let counted = 0;
    for (const row of bodyRows) {
      if (row.isSubtotal) continue;
      const cell = row.cells[colKey];
      if (!cell) continue;
      const v = getCellValue(cell.fieldKey);
      if (v === null) return null;
      sum += v;
      counted++;
    }
    return counted > 0 ? sum : null;
  };

  const isGroupBoundary = (colIdx: number): boolean => {
    const col = definition.columns[colIdx];
    const nextCol = definition.columns[colIdx + 1];
    if (!nextCol) return false;
    const currentGroup = col?.group ? localized(col.group, locale) : null;
    const nextGroup = nextCol?.group ? localized(nextCol.group, locale) : null;
    return Boolean(currentGroup && currentGroup !== nextGroup);
  };

  return (
    <div
      className={`w-full overflow-hidden border border-[var(--cam-table-frame)] rounded-[4px] bg-[var(--cam-surface)] shadow-xs ${className}`}
      style={{ maxWidth: TABLE_MAX_WIDTH_PX }}
    >
      {/* Every statistical table fills the same frame width (capped at
          TABLE_MAX_WIDTH_PX, see tableLayout.ts), so all tables line up
          whether the window is maximised or narrowed. The table only
          scrolls inside this frame once its data columns would get
          narrower than TABLE_MIN_DATA_COL_PX. */}
      <div className="w-full overflow-x-auto">
        <DataTable
          ref={tableRef}
          className="w-full border-collapse table-fixed"
          style={{ minWidth: tableMinWidthPx(definition.columns.length) }}
        >
          {definition.caption && (
            <caption className="sr-only">
              {localized(definition.caption, locale)}
            </caption>
          )}

          {/* `table-fixed` only takes effect because the table now has an
              explicit width (`w-full`). The label column is fixed; data
              columns carry no width so they share the remaining space
              equally — the same rule for every table. */}
          <colgroup>
            <col style={{ width: TABLE_LABEL_COL_PX }} />
            {definition.columns.map((col) => (
              <col key={col.key} />
            ))}
          </colgroup>

          {/* ── Table Header ── */}
          <thead className="bg-[var(--cam-table-head-bg)] text-[var(--cam-table-text)] border-b-2 border-[var(--cam-table-strong)]">
            {hasHeaderGroups ? (
              <>
                {/* Level 1: Row Header + Group Headers + Ungrouped Headers */}
                <tr>
                  <CornerHeader
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-[var(--cam-table-head-bg)] px-3 py-2.5 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] shadow-[1px_0_0_0_var(--cam-table-frame)]"
                  >
                    {localized(definition.rowHeaderLabel, locale)}
                  </CornerHeader>
                  {definition.headerGroups?.map((grp, gIdx) => (
                    <GroupHeader
                      key={gIdx}
                      colSpan={grp.colSpan}
                      className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]"
                    >
                      {localized(grp.title, locale)}
                    </GroupHeader>
                  ))}
                  {definition.columns
                    .filter((col) => !col.group)
                    .map((col) => (
                      <LeafHeader
                        key={col.key}
                        rowSpan={2}
                        className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] last:border-r-0 text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)] min-w-[65px] sm:min-w-[75px]"
                      >
                        {localized(col.header, locale)}
                        {columnIsRequired(col.key) && <RequiredAsterisk />}
                      </LeafHeader>
                    ))}
                </tr>

                {/* Level 2: Sub-columns for Groups */}
                <tr>
                  {definition.columns
                    .filter((col) => Boolean(col.group))
                    .map((col) => {
                      const origColIdx = definition.columns.findIndex((c) => c.key === col.key);
                      const isBoundary = isGroupBoundary(origColIdx);
                      return (
                        <LeafHeader
                          key={col.key}
                          className={`px-2 py-1.5 border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)] min-w-[60px] sm:min-w-[70px] ${
                            isBoundary
                              ? "border-r-2 border-r-[var(--cam-table-group-line)]"
                              : "border-r border-r-[var(--cam-table-frame)] last:border-r-0"
                          }`}
                        >
                          {localized(col.header, locale)}
                          {columnIsRequired(col.key) && <RequiredAsterisk />}
                        </LeafHeader>
                      );
                    })}
                </tr>
              </>
            ) : (
              /* Flat Single Level Header */
              <tr>
                <CornerHeader
                  className="sticky left-0 z-20 bg-[var(--cam-table-head-bg)] px-3 py-2.5 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] shadow-[1px_0_0_0_var(--cam-table-frame)]"
                >
                  {localized(definition.rowHeaderLabel, locale)}
                </CornerHeader>
                {definition.columns.map((col) => (
                  <LeafHeader
                    key={col.key}
                    className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] last:border-r-0 text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)] min-w-[60px] sm:min-w-[70px]"
                  >
                    {localized(col.header, locale)}
                    {columnIsRequired(col.key) && <RequiredAsterisk />}
                  </LeafHeader>
                ))}
              </tr>
            )}
          </thead>

          {/* ── Table Body Rows ── */}
          <tbody>
            {bodyRows.map((row, rowIdx) => {
              return (
                <tr
                  key={row.id}
                  className="hover:bg-[var(--cam-table-hover)] transition-colors duration-100 group"
                >
                  {/* Sticky Row Title */}
                  <RowHeader
                    className="sticky left-0 z-10 bg-[var(--cam-surface)] group-hover:bg-[var(--cam-table-hover)] px-3 py-2 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] shadow-[1px_0_0_0_var(--cam-table-frame)]"
                  >
                    <div className="flex items-center gap-2">
                      {row.code && (
                        <RowCode>{row.code}</RowCode>
                      )}
                      <span>{localized(row.label, locale)}</span>
                      {rowIsRequired(row) && <RequiredAsterisk />}
                    </div>
                  </RowHeader>

                  {/* Value Cells */}
                  {definition.columns.map((col, colIdx) => {
                    const cellDef = row.cells[col.key];
                    if (!cellDef) {
                      return (
                        <Cell
                          key={col.key}
                          className="px-2 py-1.5 border-r border-b border-[var(--cam-table-line)] last:border-r-0 bg-[var(--cam-surface)]"
                        >
                          <CellValue value={null} />
                        </Cell>
                      );
                    }

                    const val = getCellValue(cellDef.fieldKey);
                    const isComputed = cellDef.kind === "computed";
                    const cellLabel = `${localized(row.label, locale)} - ${col.group ? `${localized(col.group, locale)} - ` : ""}${localized(col.header, locale)}`;
                    const isBoundary = isGroupBoundary(colIdx);
                    const cellBorderCls = isBoundary
                      ? "border-r-2 border-r-[var(--cam-table-strong)] border-b border-b-[var(--cam-table-line)]"
                      : "border-r border-[var(--cam-table-line)] border-b border-b-[var(--cam-table-line)] last:border-r-0";

                    if (isComputed) {
                      return (
                        <CoherenceTd
                          key={col.key}
                          fieldKey={cellDef.fieldKey}
                          tableFieldId={tableFieldId}
                          aria-readonly="true"
                          aria-label={`${cellLabel} (${t("calculatedTotal")})`}
                          className={`px-2.5 py-1.5 bg-[var(--cam-table-readonly-bg)] ${cellBorderCls}`}
                        >
                          <CellValue value={val} computed />
                        </CoherenceTd>
                      );
                    }

                    const isMissing = missing.has(cellDef.fieldKey);

                    return (
                      <CoherenceTd
                        key={col.key}
                        fieldKey={cellDef.fieldKey}
                        tableFieldId={tableFieldId}
                        hasInput
                        className={`p-0 bg-[var(--cam-surface)] ${cellBorderCls}`}
                      >
                        <NumberInput
                          id={`cell-input-${cellDef.fieldKey}`}
                          data-field-key={cellDef.fieldKey}
                          type="number"
                          min={cellDef.min ?? 0}
                          max={cellDef.max}
                          inputMode="numeric"
                          data-row-idx={rowIdx}
                          data-col-idx={colIdx}
                          disabled={disabled}
                          value={val != null ? val : ""}
                          placeholder="—"
                          aria-label={cellLabel}
                          aria-required={cellDef.required ? "true" : undefined}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) =>
                            handleCellChange(row, col, e.target.value)
                          }
                          onKeyDown={(e) =>
                            handleCellKeyDown(e, rowIdx, colIdx)
                          }
                          onFocus={(e) => e.target.select()}
                          className={`w-full h-full min-h-[34px] px-2 py-1 bg-transparent border-0 outline-none rounded-none focus:ring-2 focus:ring-inset focus:ring-[var(--cam-table-focus)] focus:bg-transparent transition-colors ${
                            isMissing ? "ring-2 ring-inset ring-[var(--cam-error)] bg-[rgba(179,38,30,0.06)]" : ""
                          }`}
                        />
                      </CoherenceTd>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* ── Optional Grand Total Row in semantic tfoot ── */}
          {(totalRow || definition.hasTotalRow) && (
            <tfoot className="bg-[var(--cam-table-readonly-bg)] border-t-2 border-[var(--cam-table-strong)]">
              <tr>
                <RowHeader
                  total
                  className="sticky left-0 z-20 bg-[var(--cam-table-readonly-bg)] px-3 py-2.5 border-r border-[var(--cam-table-frame)] shadow-[1px_0_0_0_var(--cam-table-frame)]"
                >
                  {definition.totalRowLabel
                    ? localized(definition.totalRowLabel, locale)
                    : totalRow
                      ? localized(totalRow.label, locale)
                      : t("grandTotal")}
                </RowHeader>
                {definition.columns.map((col, colIdx) => {
                  const cellDef = totalRow ? totalRow.cells[col.key] : null;
                  const val = cellDef
                    ? getCellValue(cellDef.fieldKey)
                    : totalRow
                      ? null
                      : columnSum(col.key);
                  const totalCellLabel = totalRow
                    ? `${localized(totalRow.label, locale)} - ${col.group ? `${localized(col.group, locale)} - ` : ""}${localized(col.header, locale)}`
                    : localized(col.header, locale);
                  const isBoundary = isGroupBoundary(colIdx);
                  const footBorderCls = isBoundary
                    ? "border-r-2 border-r-[var(--cam-table-strong)]"
                    : "border-r border-[var(--cam-table-line)] last:border-r-0";

                  return (
                    <CoherenceTd
                      key={col.key}
                      fieldKey={cellDef?.fieldKey}
                      tableFieldId={tableFieldId}
                      aria-readonly="true"
                      aria-label={`${totalCellLabel} (${t("calculatedTotal")})`}
                      className={`px-2.5 py-2 bg-[var(--cam-table-readonly-bg)] ${footBorderCls}`}
                    >
                      <CellValue value={val} total />
                    </CoherenceTd>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </DataTable>
      </div>
    </div>
  );
}
