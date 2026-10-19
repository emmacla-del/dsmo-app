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

// One frame per box, not two.
//
// This table's cells used to carry a border of their own AND each control a
// second one inside it, a millimetre apart — a double frame around every
// answer, and the row so tight that a text box and the dropdown next to it
// read as one broken control. The frame belongs to the control here: unlike
// the statistical grids, these cells are a form (free text and coded
// dropdowns, no numbers, no totals), so they wear the wizard's own control —
// .sovereign-text-input / .sovereign-select, the same height, edge, radius
// and green focus as the boxes of Sections 0 and 1 — and the cells space
// them out with border-spacing, the table's own version of a flex gap.
// Typography still comes from DataTable's classes, so the entries keep the
// size and weight every other table's entries have (npm run check:tables).

const thStyle: LayoutStyle = {
  // No rule under the header: with the boxes framed and spaced, a line per
  // column drew six loose dashes across the top (§8, no decoration).
  padding: 0,
  color: "var(--cam-table-muted)",
  whiteSpace: "nowrap",
};

const tdStyle: LayoutStyle = { padding: 0 };

/** The line's number, beside its boxes — muted, no rule of its own. */
const rowNumberStyle: LayoutStyle = {
  padding: 0,
  color: "var(--cam-table-muted)",
  whiteSpace: "nowrap",
};

/** A box as wide as the answer it expects (GOV.UK sizes a box to its answer). */
const CONTROL_WIDTH: Record<string, number> = {
  description: 260,
  targetPopulation: 180,
  supportType: 190,
  scope: 160,
  startDate: 130,
  duration: 110,
};

const controlStyle = (key: string): LayoutStyle => ({
  width: CONTROL_WIDTH[key] ?? 160,
  maxWidth: "100%",
});

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
        {/* separate + border-spacing: the gap between two answer boxes, the
            table's own version of a flex gap (a <tr> cannot be a flex row
            without losing what a row and a cell mean to a screen reader). */}
        <DataTable
          style={{
            borderCollapse: "separate",
            borderSpacing: "var(--cam-space-4) var(--cam-space-2)",
            // border-spacing also pads the table's own edges; pull that back
            // so the first box lines up with the question above it.
            margin: "0 calc(-1 * var(--cam-space-4))",
          }}
        >
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
                          className={`sovereign-select${missing.has(cellId) ? " has-error" : ""}`}
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
                          className={`sovereign-text-input${missing.has(cellId) ? " has-error" : ""}`}
                          placeholder={localized(f.hint, locale)}
                          style={controlStyle(f.key)}
                          value={value}
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
