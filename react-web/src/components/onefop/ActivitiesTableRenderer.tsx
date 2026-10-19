"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { TableQuestionHeading } from "@/components/onefop/table/TableQuestionHeading";
import { ACTIVITIES_ROW_CAPACITY, ACTIVITIES_TABLE_FIELDS } from "@/lib/onefop-activities";
import { missingActivitiesCells } from "@/lib/onefop-validation";
import { tableCellLabel } from "@/lib/table-cell-label";
import {
  Cell,
  CornerHeader,
  DataTable,
  LeafHeader,
  RowHeader,
  SelectInput,
  TextInput,
  type LayoutStyle,
} from "./table/DataTable";

// One frame per answer, and it is the cell's.
//
// Every cell here used to carry a border AND the control inside it a second
// one, a millimetre apart: a double frame around every answer, and a text box
// that read as one broken control with the dropdown beside it. Free-standing
// framed boxes, spaced like a form, were worse — a row of six is wider than
// the screen and the grid stops being a grid. So the table keeps its cells and
// the controls lose their own edge: each one fills its cell, transparent and
// borderless, and shows an inset ring on focus — the same cell input
// StatisticalGridRenderer and VtProgressiveRowGrid use, which is what every
// other table in the wizard looks like.

const thStyle: LayoutStyle = {
  border: "1px solid var(--cam-table-line)",
  padding: "var(--cam-space-2)",
  background: "var(--cam-table-head-bg)",
  color: "var(--cam-table-text)",
  whiteSpace: "nowrap",
};

/** The control fills the cell, so the cell keeps no padding of its own. */
const tdStyle: LayoutStyle = {
  border: "1px solid var(--cam-table-line)",
  padding: 0,
};

/** The line's number, in the cell the row header occupies. */
const rowNumberStyle: LayoutStyle = {
  border: "1px solid var(--cam-table-line)",
  padding: "var(--cam-space-2)",
  background: "var(--cam-table-head-bg)",
  color: "var(--cam-table-text)",
  whiteSpace: "nowrap",
};

/** A column as wide as the answer it expects, and no wider. */
const CONTROL_MIN_WIDTH: Record<string, number> = {
  description: 220,
  targetPopulation: 150,
  supportType: 160,
  scope: 130,
  startDate: 110,
  duration: 90,
};

const controlStyle = (key: string): LayoutStyle => ({ minWidth: CONTROL_MIN_WIDTH[key] ?? 130 });

/** The same in-cell control every other grid uses (globals.css): no edge of
 *  its own, a tint under the pointer, an inset ring on focus, and the red
 *  ring of a cell a started line still owes, drawn from its aria-invalid. */
const CELL_INPUT_CLASS = "cam-cell-input";

interface ActivitiesTableRendererProps {
  field: OnefopField;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
  /** True once the respondent has pressed Continue: the boxes a started line
   *  still owes are marked, as they are in every other table. */
  attemptedContinue?: boolean;
}

/**
 * activities_table (Project/Program's PP_S2_ACTIVITIES) — a variable-row,
 * heterogeneous-column repeating table: free text + several coded
 * dropdowns per row, no computed cells at all (confirmed against
 * activities_table.dart — it never routes through GridRenderSpec/
 * TableCellEngine). Rendered here as one dense semantic <table>
 * (CAM-LEAP's spreadsheet-style density) rather than Flutter's own
 * per-row bordered-card layout — the plan's own rule for VT applies
 * equally here: rebuild the presentation with browser-native mechanisms,
 * don't mechanically port the Flutter widget tree.
 */
export function ActivitiesTableRenderer({
  field,
  data,
  onChange,
  attemptedContinue = false,
}: ActivitiesTableRendererProps) {
  const t = useTranslations();
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const isEn = locale === "en";
  const label = localized(field.label, locale);
  const prefix = field.table?.id ?? field.id;
  const capacity = field.table?.rowCapacity ?? ACTIVITIES_ROW_CAPACITY;

  // The respondent adds the lines they need, as in the training-centre
  // tables (VtProgressiveRowGrid): a row is on screen once one of its cells
  // holds something, plus whatever "Add a line" has opened, plus the first
  // line, which the paper form offers straight away. All thirteen slots at
  // once meant seventy-eight empty controls on a first visit — and a row
  // only half filled is an error (validateActivitiesTable), which is easier
  // to avoid when the lines are deliberate.
  const [opened, setOpened] = useState<number[]>([]);
  const focusRow = useRef<number | null>(null);

  const rowCells = (n: number) => ACTIVITIES_TABLE_FIELDS.map((f) => `${prefix}_row${n}_${f.key}`);
  const entered = (cellId: string) => {
    const v = data[cellId];
    return v !== undefined && v !== null && String(v).trim() !== "";
  };

  const started = Array.from({ length: capacity }, (_, i) => i + 1).filter((n) => rowCells(n).some(entered));
  // The same cells validation names in the error summary (missingActivitiesCells).
  const missing = new Set(attemptedContinue ? missingActivitiesCells(field, data).map((c) => c.cellId) : []);
  const shownSet = new Set([...started, ...opened]);
  if (shownSet.size === 0) shownSet.add(1);
  const shown = [...shownSet].sort((a, b) => a - b);
  const nextFree = Array.from({ length: capacity }, (_, i) => i + 1).find((n) => !shownSet.has(n)) ?? null;

  useEffect(() => {
    if (focusRow.current === null) return;
    document.getElementById(`cell-input-${prefix}_row${focusRow.current}_description`)?.focus();
    focusRow.current = null;
  });

  const addRow = () => {
    if (nextFree === null) return;
    focusRow.current = nextFree;
    // Keep every line already on screen, the untouched first one included.
    setOpened((o) => [...new Set([...o, ...shown, nextFree])]);
  };

  // Takes the line off the screen and empties its cells — which is what the
  // training-centre tables call « Supprimer » (VtProgressiveRowGrid), so the
  // same gesture now has the same name in both. Clearing writes "" — not 0,
  // which for a duration would be a real answer.
  const removeRow = (n: number) => {
    for (const id of rowCells(n)) if (entered(id)) onChange(id, "");
    setOpened((o) => o.filter((s) => s !== n));
  };

  return (
    <div style={{ marginBottom: "var(--cam-form-gap)" }}>
      <TableQuestionHeading
        code={field.paperCode}
        text={label}
        style={{ marginBottom: "var(--cam-space-3)" }}
      />
      <div style={{ overflowX: "auto" }}>
        <DataTable style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <CornerHeader style={thStyle} />
              {ACTIVITIES_TABLE_FIELDS.map((f) => (
                <LeafHeader key={f.key} style={thStyle}>
                  {localized(f.label, locale)}
                </LeafHeader>
              ))}
              {/* The header stays off screen, as the training-centre tables
                  head their own Supprimer column (VtProgressiveRowGrid). */}
              <LeafHeader style={thStyle}>
                <span className="sr-only">Actions</span>
              </LeafHeader>
            </tr>
          </thead>
          <tbody>
            {shown.map((n, i) => (
              <tr key={n}>
                <RowHeader style={rowNumberStyle}>
                  {i + 1}
                </RowHeader>
                {ACTIVITIES_TABLE_FIELDS.map((f) => {
                  const cellId = `${prefix}_row${n}_${f.key}`;
                  const value = (data[cellId] as string) ?? "";
                  const cellLabel = tableCellLabel(
                    [t("vtTableRenderer.defaultRowLabel", { number: i + 1 }), localized(f.label, locale)],
                    cellId,
                  );
                  return (
                    <Cell key={f.key} style={tdStyle}>
                      {f.options ? (
                        <SelectInput
                          id={`cell-input-${cellId}`}
                          aria-label={cellLabel}
                          aria-invalid={missing.has(cellId) ? true : undefined}
                          className={CELL_INPUT_CLASS}
                          style={controlStyle(f.key)}
                          value={value}
                          onChange={(e) => onChange(cellId, e.target.value)}
                        >
                          <option value="" disabled>
                            {localized(f.hint, locale)}
                          </option>
                          {f.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {localized(opt.label, locale)}
                            </option>
                          ))}
                        </SelectInput>
                      ) : (
                        <TextInput
                          id={`cell-input-${cellId}`}
                          short={f.key !== "description"}
                          type={f.key === "duration" ? "number" : "text"}
                          aria-label={cellLabel}
                          aria-invalid={missing.has(cellId) ? true : undefined}
                          className={CELL_INPUT_CLASS}
                          placeholder={localized(f.hint, locale)}
                          style={controlStyle(f.key)}
                          value={value}
                          // What the statistical grids give a cell: typing
                          // replaces what is there, and the wheel scrolls the
                          // page rather than changing a number under the
                          // pointer.
                          onFocus={(e) => e.target.select()}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => onChange(cellId, e.target.value)}
                        />
                      )}
                    </Cell>
                  );
                })}
                <Cell style={tdStyle}>
                  <button
                    type="button"
                    className="cam-text-button is-danger"
                    onClick={() => removeRow(n)}
                    disabled={shown.length === 1 && started.length === 0}
                    aria-label={isEn ? `Remove line ${i + 1}` : `Supprimer la ligne ${i + 1}`}
                  >
                    {isEn ? "Remove" : "Supprimer"}
                  </button>
                </Cell>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
      <div
        style={{
          marginTop: "var(--cam-space-3)",
          display: "flex",
          alignItems: "center",
          gap: "var(--cam-space-3)",
          flexWrap: "wrap",
        }}
      >
        <button type="button" className="cam-text-button" onClick={addRow} disabled={nextFree === null}>
          {isEn ? "Add a line" : "Ajouter une ligne"}
        </button>
        <span style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
          {isEn
            ? `${shown.length} of ${capacity} lines at most`
            : `${shown.length} ligne(s) sur ${capacity} au maximum`}
        </span>
      </div>
    </div>
  );
}
