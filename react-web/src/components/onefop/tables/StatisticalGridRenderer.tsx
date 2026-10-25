"use client";

import React, {
  useRef,
  useEffect,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, LocalizedText } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import type {
  FixedMatrixDefinition,
  StatisticalRowDefinition,
  StatisticalColumnDefinition,
} from "./StatisticalTableDefinition";
import {
  TABLE_LABEL_COL_PX,
  TABLE_MAX_WIDTH_PX,
  TABLE_REPEAT_HEADINGS_ABOVE_ROWS,
  TABLE_REPEAT_HEADINGS_EVERY,
  spanningHeadingsOf,
  tableDataColumnWidthPx,
  tablePreferredWidthPx,
} from "./tableLayout";
import {
  blankCellKeys,
  parseCount,
  parsePastedGrid,
  planCopyDown,
  planPaste,
  planZeroEmptyRows,
  snapshotOf,
  typedCellCount,
} from "./gridEntry";
import { TableEntryBar } from "./TableEntryBar";
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
  /**
   * True when this grid is showing one column block of a wider table
   * (AdaptiveStatisticalTable's block tabs). The check-total line is left out
   * then: the foot it would compare against covers the visible columns only,
   * so the figure would not be the table's population.
   */
  columnSliced?: boolean;
}

/**
 * Each data column's width: what its definition declares, else the one width
 * the table's headings call for (see tableLayout.ts) — the column headings,
 * the groups over them and any band over those. AdaptiveStatisticalTable
 * sizes the table from this too, to decide whether it must split.
 */
export function matrixDataColumnWidthsPx(
  definition: Pick<FixedMatrixDefinition, "columns" | "headerGroups">,
  locale: "fr" | "en",
): number[] {
  const text = (t: LocalizedText | undefined) => (t ? localized(t, locale) : undefined);
  const groups = definition.headerGroups?.length
    ? definition.headerGroups.map((g) => ({ heading: localized(g.title, locale), columns: g.colSpan }))
    : spanningHeadingsOf(definition.columns.map((c) => text(c.group)));
  const shared = tableDataColumnWidthPx(
    definition.columns.map((c) => localized(c.header, locale)),
    [...groups, ...spanningHeadingsOf(definition.columns.map((c) => text(c.band)))],
  );
  // A non-numeric declared width cannot be summed, so it takes the shared one.
  return definition.columns.map((c) => (typeof c.width === "number" ? c.width : shared));
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
/** Consecutive columns sharing one heading, in column order; a column with
 *  none of its own stands alone, so it can head the rows below it. */
function headerRuns<T>(
  columns: T[],
  of: (col: T) => LocalizedText | undefined,
): Array<{ value: LocalizedText | undefined; items: T[] }> {
  const runs: Array<{ value: LocalizedText | undefined; items: T[] }> = [];
  for (const col of columns) {
    const value = of(col);
    const open = runs[runs.length - 1];
    if (open && value && open.value && open.value.fr === value.fr && open.value.en === value.en) {
      open.items.push(col);
    } else {
      runs.push({ value, items: [col] });
    }
  }
  return runs;
}

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
  columnSliced = false,
}: StatisticalGridRendererProps) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const t = useTranslations("modernJobs.grid");
  const tableRef = useRef<HTMLTableElement>(null);
  const missing = new Set(missingFieldKeys ?? []);
  // No red star on a required row or column: every cell the respondent can
  // enter in a quiz-opened table is required, so the star marked nearly
  // everything and told nothing. The section says once that questions are
  // required unless marked optional; each cell keeps aria-required (owner,
  // 2026-10-22).

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
  // A third level above the groups, where the paper prints one (5.3). The
  // columns outside it head all three rows, as "Nombre total de locaux"
  // does on paper.
  const hasBands = definition.columns.some((col) => Boolean(col.band));

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

  /**
   * Bulk entry aids — pasting a block from a spreadsheet, recopying the cell
   * above, putting 0 in the rows that carry no figure. Each goes through
   * `onBatchChange` when the controller supplied one, so the whole block is
   * one change and one recalculation rather than a write per cell, and each
   * leaves one step of undo behind it: nothing here may answer for the
   * respondent irreversibly (§9).
   */
  const [notice, setNotice] = useState<string | null>(null);
  const [undoable, setUndoable] = useState<Record<string, unknown> | null>(null);
  /**
   * The figure the respondent expects this table to come to. Entry aid only:
   * it is held here and nowhere else — never written to the form data, never
   * submitted, never exported. The canonical questionnaire has no question
   * for it, and inventing a key for it is the half that needs a decision of
   * its own (CLAUDE.md §21, the 2026-10-19 entry).
   */
  const [expectedTotal, setExpectedTotal] = useState("");

  const writeUpdates = (updates: Record<string, unknown>) => {
    if (onBatchChange) onBatchChange(updates);
    else for (const [key, value] of Object.entries(updates)) onChange(key, value);
  };

  /**
   * The row totals a bulk write leaves behind. A table that declares no
   * `recalc` has its totals kept by handleCellChange as each cell is typed
   * (VT 4.1), so a pasted or zeroed block must keep them the same way —
   * otherwise the calculated column still shows the figures from before the
   * paste. A table that declares one is left to it: the Modern Jobs tables
   * recalculate in AdaptiveStatisticalTable, and the VT fixed-row tables
   * declare a no-op recalc on purpose, their totals being the business of
   * useVtFixedRowTotals (a whole-row sum would be wrong for a grouped table
   * such as 4.8).
   */
  const withRowTotals = (updates: Record<string, unknown>): Record<string, unknown> => {
    if (definition.recalc) return updates;
    const next = { ...updates };
    const read = (fieldKey: string): number | null => {
      const raw = fieldKey in updates ? updates[fieldKey] : data[fieldKey];
      if (raw === undefined || raw === null || raw === "") return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    };
    for (const row of definition.rows) {
      const computed = Object.values(row.cells).find((c) => c.kind === "computed");
      if (!computed) continue;
      if (!Object.values(row.cells).some((c) => c.fieldKey in updates)) continue;
      let sum = 0;
      let any = false;
      for (const cell of Object.values(row.cells)) {
        if (cell.kind !== "number") continue;
        const value = read(cell.fieldKey);
        if (value === null) continue;
        sum += value;
        any = true;
      }
      next[computed.fieldKey] = any ? sum : null;
    }
    return next;
  };

  const applyUpdates = (updates: Record<string, unknown>, message: string | null) => {
    const full = withRowTotals(updates);
    if (Object.keys(full).length > 0) {
      setUndoable(snapshotOf(Object.keys(full), data));
      writeUpdates(full);
    }
    setNotice(message);
  };

  const undoLastBulk = () => {
    if (!undoable) return;
    writeUpdates(undoable);
    setUndoable(null);
    setNotice(t("bulkUndone"));
  };

  /**
   * A block copied from a spreadsheet lands at the focused cell and spreads
   * right and down, the convention every spreadsheet uses. Calculated cells
   * keep their own value, and a value that is not a whole count is refused
   * rather than rounded — the respondent is told how many, in both cases.
   */
  const handleCellPaste = (
    e: ClipboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
  ) => {
    const grid = parsePastedGrid(e.clipboardData?.getData("text/plain") ?? "");
    if (grid.length === 0) return;
    e.preventDefault();
    const plan = planPaste(definition, rowIdx, colIdx, grid);
    const filled = Object.keys(plan.updates).length;
    const parts: string[] = [];
    // One value into one cell needs no report; anything refused always does.
    const single = grid.length === 1 && grid[0].length === 1;
    if (!single) parts.push(t("pasteFilled", { count: filled }));
    if (plan.computedSkipped > 0) parts.push(t("pasteSkippedComputed", { count: plan.computedSkipped }));
    if (plan.rejected > 0) parts.push(t("pasteRejected", { count: plan.rejected }));
    if (plan.outside > 0) parts.push(t("pasteOutside", { count: plan.outside }));
    applyUpdates(plan.updates, parts.length > 0 ? parts.join(" · ") : null);
  };

  const focusCell = (fieldKey: string) => {
    const input = tableRef.current?.querySelector<HTMLInputElement>(
      `input[data-field-key="${fieldKey}"]`,
    );
    if (!input) return;
    input.focus();
    input.select();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
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

    // Ctrl+D / Cmd+D -> recopy the cell above, as a spreadsheet does. The
    // browser's own bookmark shortcut is given up inside a grid cell only.
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      const updates = planCopyDown(definition, rowIdx, colIdx, data);
      if (updates) applyUpdates(updates, null);
      return;
    }

    // A count is digits only. Refusing the keystroke is kinder than letting a
    // decimal point, a sign or an "e" through for the validator to reject
    // after the fact — type="number" accepts all three. Paste is sanitised in
    // handleCellPaste, and every editing and navigation key is untouched
    // (they are not single characters, or they carry a modifier).
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !/[0-9]/.test(e.key)) {
      e.preventDefault();
      // Said, not swallowed: a respondent typing "1,5" would otherwise be
      // left with 15 and no idea where the comma went. Chrome already drops
      // the comma in a number input, so this is the first time the refusal
      // is visible at all.
      setNotice(t("digitsOnly"));
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

  // Each column takes the width its own definition asks for, else the
  // table's shared one. Both mattered (owner, 2026-10-11): the columns
  // previously carried no width at all, so they shared the frame's slack
  // equally and a three-digit count could land in a 268px cell — and the
  // widths these definitions already declared were being ignored.
  const dataColWidths = matrixDataColumnWidthsPx(definition, locale);
  const preferredTableWidth = tablePreferredWidthPx(dataColWidths);

  /* ── The entry bar under the table ───────────────────────────────────
     What is left to fill, the way to the next blank cell, the two bulk
     actions and their undo, and the respondent's own check total. One quiet
     line of text and text actions: §8 asks for no cards, no containers and
     no decoration around them. */
  const blanks = blankCellKeys(definition, data);
  const typedCells = typedCellCount(definition);
  const zeroPlan = planZeroEmptyRows(definition, data);
  const lastColumn = definition.columns[definition.columns.length - 1];
  const footShown = Boolean(totalRow || definition.hasTotalRow);
  /* The check total is measured against the one figure on screen that is the
     table's whole population: the foot cell under a last column which is
     itself a calculated total. A table without one — VT 5.3, whose total is
     typed and whose columns count buildings by material — is offered no
     check rather than a misleading one (§5, §22). */
  const checkTotalShown = Boolean(!columnSliced && footShown && lastColumn?.kind === "computed");
  const totalRowCell = totalRow && lastColumn ? totalRow.cells[lastColumn.key] : undefined;
  const grandTotal = !checkTotalShown
    ? null
    : totalRow
      ? totalRowCell
        ? getCellValue(totalRowCell.fieldKey)
        : null
      : columnSum(lastColumn!.key);
  const expectedParsed = parseCount(expectedTotal);
  const expectedValue = expectedParsed.ok ? expectedParsed.value : null;
  const checkGap =
    expectedValue !== null && grandTotal !== null ? expectedValue - grandTotal : null;

  const entryBar = (
    <TableEntryBar
      blanks={blanks.length}
      typedCells={typedCells}
      onGoToFirstBlank={() => focusCell(blanks[0])}
      zeroRows={zeroPlan.rows}
      onZeroEmptyRows={() => applyUpdates(zeroPlan.updates, t("zeroedRows", { count: zeroPlan.rows }))}
      notice={notice}
      disabled={disabled}
      {...(undoable ? { onUndo: undoLastBulk } : {})}
      {...(checkTotalShown
        ? {
            checkTotal: {
              inputId: `check-total-${definition.id}`,
              value: expectedTotal,
              onChange: setExpectedTotal,
              grandTotal,
              valid: expectedParsed.ok,
              gap: checkGap,
            },
          }
        : {})}
    />
  );

  return (
    // The frame, then the entry bar under it: the bar is outside the frame's
    // border on purpose, so it reads as a note beside the table rather than
    // another row of it.
    <>
    <div
      // The frame's line is drawn twice: by its border, and by an ::after
      // ring laid over it at z-[21]. The sticky first-column cells (z-20)
      // are painted as layers of their own and snapped to whole device
      // pixels; at a fractional scale (125%) and a fractional offset they
      // landed one device pixel over the 1-device-pixel border and erased
      // the frame's top and left edges beside them (owner, 2026-10-22). The
      // ring stays under the sticky tab strips (z-25/26) and the wizard's
      // header. The frame no longer clips (`overflow-hidden` would clip the
      // ring away); the scroller below rounds its own corners instead.
      className={`relative border border-[var(--cam-table-frame)] rounded-[4px] bg-[var(--cam-surface)] shadow-xs after:pointer-events-none after:absolute after:-inset-px after:z-[21] after:rounded-[4px] after:border after:border-[var(--cam-table-frame)] after:content-[''] ${className}`}
      style={{ width: "100%", maxWidth: `min(100%, ${TABLE_MAX_WIDTH_PX}px)` }}
    >
      {/* The frame hugs the table's own columns, never exceeding
          TABLE_MAX_WIDTH_PX (see tableLayout.ts). The table only scrolls
          inside this frame once the frame is narrower than the columns ask
          for. */}
      <div className="relative w-full overflow-x-auto rounded-[3px]">
        <DataTable
          ref={tableRef}
          className="border-collapse table-fixed"
          style={{ width: "100%", minWidth: preferredTableWidth }}
        >
          {definition.caption && (
            <caption className="sr-only">
              {localized(definition.caption, locale)}
            </caption>
          )}

          {/* `table-fixed` takes its widths from here: the shared label
              column, then each data column at its own capped width. */}
          <colgroup>
            {/* No width: the label column absorbs whatever the pod leaves over,
                so the data columns keep theirs. */}
            <col style={{ minWidth: TABLE_LABEL_COL_PX }} />
            {definition.columns.map((col, i) => (
              <col key={col.key} style={{ width: dataColWidths[i] }} />
            ))}
          </colgroup>

          {/* ── Table Header ── */}
          <thead className="bg-[var(--cam-table-head-bg)] text-[var(--cam-table-text)] border-b-2 border-[var(--cam-table-strong)]">
            {hasBands ? (
              <>
                {/* Level 1: the band the paper prints over the groups; a
                    column outside every band heads all three rows. */}
                <tr>
                  <CornerHeader
                    rowSpan={3}
                    className="sticky left-0 z-20 bg-[var(--cam-table-head-bg)] px-3 py-2.5 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] shadow-[1px_0_0_0_var(--cam-table-frame)]"
                  >
                    {localized(definition.rowHeaderLabel, locale)}
                  </CornerHeader>
                  {headerRuns(definition.columns, (c) => c.band).map((run, i) =>
                    run.value ? (
                      <GroupHeader
                        key={`band-${i}`}
                        colSpan={run.items.length}
                        // The columns are sized so the band fits on two lines
                        // between words; break-words only splits a word that
                        // could not fit its span at all.
                        className="px-2.5 py-2 break-words border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]"
                      >
                        {localized(run.value, locale)}
                      </GroupHeader>
                    ) : (
                      run.items.map((col) => (
                        <LeafHeader
                          key={col.key}
                          rowSpan={3}
                          className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] last:border-r-0 text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)] min-w-[65px] sm:min-w-[75px]"
                        >
                          {localized(col.header, locale)}
                        </LeafHeader>
                      ))
                    ),
                  )}
                </tr>

                {/* Level 2: the groups inside a band; a banded column with no
                    group of its own heads the two rows below the band. */}
                <tr>
                  {headerRuns(
                    definition.columns.filter((col) => Boolean(col.band)),
                    (c) => c.group,
                  ).map((run, i) =>
                    run.value ? (
                      <GroupHeader
                        key={`group-${i}`}
                        colSpan={run.items.length}
                        className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]"
                      >
                        {localized(run.value, locale)}
                      </GroupHeader>
                    ) : (
                      run.items.map((col) => (
                        <LeafHeader
                          key={col.key}
                          rowSpan={2}
                          className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] last:border-r-0 text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)] min-w-[65px] sm:min-w-[75px]"
                        >
                          {localized(col.header, locale)}
                        </LeafHeader>
                      ))
                    ),
                  )}
                </tr>

                {/* Level 3: the columns of those groups. */}
                <tr>
                  {definition.columns
                    .filter((col) => Boolean(col.band) && Boolean(col.group))
                    .map((col) => {
                      const isBoundary = isGroupBoundary(
                        definition.columns.findIndex((c) => c.key === col.key),
                      );
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
                        </LeafHeader>
                      );
                    })}
                </tr>
              </>
            ) : hasHeaderGroups ? (
              <>
                {/* Level 1: Row Header + Group Headers + Ungrouped Headers */}
                <tr>
                  <CornerHeader
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-[var(--cam-table-head-bg)] px-3 py-2.5 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] shadow-[1px_0_0_0_var(--cam-table-frame)]"
                  >
                    {localized(definition.rowHeaderLabel, locale)}
                  </CornerHeader>
                  {/* In column order: a band opens at the first column of its
                      group (headerGroups are positional, one per run of grouped
                      columns); an ungrouped column spans both header rows. */}
                  {(() => {
                    const cells: ReactNode[] = [];
                    let groupIdx = 0;
                    for (let i = 0; i < definition.columns.length; i++) {
                      const col = definition.columns[i];
                      if (col.group) {
                        const grp = definition.headerGroups?.[groupIdx++];
                        if (!grp) continue;
                        cells.push(
                          <GroupHeader
                            key={`group-${i}`}
                            colSpan={grp.colSpan}
                            className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]"
                          >
                            {localized(grp.title, locale)}
                          </GroupHeader>,
                        );
                        i += grp.colSpan - 1;
                        continue;
                      }
                      cells.push(
                        <LeafHeader
                          key={col.key}
                          rowSpan={2}
                          className="px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] last:border-r-0 text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)] min-w-[65px] sm:min-w-[75px]"
                        >
                          {localized(col.header, locale)}
                        </LeafHeader>,
                      );
                    }
                    return cells;
                  })()}
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
                  </LeafHeader>
                ))}
              </tr>
            )}
          </thead>

          {/* ── Table Body Rows ── */}
          <tbody>
            {bodyRows.map((row, rowIdx) => {
              // Partway down a long table, the headings are said again, as a
              // printed statistical table repeats them (tableLayout.ts says
              // why this rather than a sticky header). Decorative: every cell
              // already carries its own full label, so the row is hidden from
              // assistive technology rather than read out a second time.
              const repeatHeadings =
                bodyRows.length > TABLE_REPEAT_HEADINGS_ABOVE_ROWS &&
                rowIdx > 0 &&
                rowIdx % TABLE_REPEAT_HEADINGS_EVERY === 0;
              return (
                <React.Fragment key={row.id}>
                {repeatHeadings && (
                  <tr aria-hidden="true" data-repeat-headings="true">
                    <RowHeader className="sticky left-0 z-10 bg-[var(--cam-table-head-bg)] px-3 py-2 border-r border-y border-[var(--cam-table-frame)] text-[var(--cam-table-text)] shadow-[1px_0_0_0_var(--cam-table-frame)]">
                      {localized(definition.rowHeaderLabel, locale)}
                    </RowHeader>
                    {definition.columns.map((col) => (
                      <LeafHeader
                        key={`repeat-${col.key}`}
                        className="px-2 py-1.5 border-r border-y border-[var(--cam-table-frame)] last:border-r-0 text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]"
                      >
                        {[col.band, col.group, col.header]
                          .filter((part): part is LocalizedText => Boolean(part))
                          .map((part) => localized(part, locale))
                          .join(" — ")}
                      </LeafHeader>
                    ))}
                  </tr>
                )}
                <tr
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
                          aria-label={cellLabel}
                          aria-required={cellDef.required ? "true" : undefined}
                          // A marked cell says so to assistive technology
                          // too, not only in colour (audit R6).
                          aria-invalid={isMissing ? true : undefined}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) =>
                            handleCellChange(row, col, e.target.value)
                          }
                          onKeyDown={(e) =>
                            handleCellKeyDown(e, rowIdx, colIdx)
                          }
                          onPaste={(e) => handleCellPaste(e, rowIdx, colIdx)}
                          onFocus={(e) => e.target.select()}
                          // The mark comes from aria-invalid above (globals.css).
                          className="cam-cell-input"
                        />
                      </CoherenceTd>
                    );
                  })}
                </tr>
                </React.Fragment>
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
    {entryBar}
    </>
  );
}
