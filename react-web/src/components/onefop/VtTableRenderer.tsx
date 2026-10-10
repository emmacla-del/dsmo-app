"use client";

import { useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField, VtCellDef } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import { recalculateVtRow, type CellValues } from "@/lib/onefop-formulas";
import { tableCellLabel } from "@/lib/table-cell-label";
import {
  Cell,
  CornerHeader,
  DataTable,
  LeafHeader,
  NumberInput,
  RowHeader,
  SelectInput,
  TextInput,
  type LayoutStyle,
} from "./table/DataTable";

// Layout only — typography comes from DataTable (see table/DataTable.tsx).
const thStyle: LayoutStyle = {
  border: "1px solid var(--cam-table-line)",
  padding: "var(--cam-space-2)",
  background: "var(--cam-table-head-bg)",
  color: "var(--cam-table-text)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const tdStyle: LayoutStyle = {
  border: "1px solid var(--cam-table-line)",
  padding: "var(--cam-space-1)",
};

const cellInputStyle: LayoutStyle = {
  width: 64,
  height: 32,
  border: "1px solid var(--cam-border-strong)",
  borderRadius: "var(--cam-radius-sm)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 600,
  marginBottom: "var(--cam-space-2)",
};

const placeholderStyle: React.CSSProperties = {
  border: "1px dashed var(--cam-border-strong)",
  borderRadius: "var(--cam-radius-sm)",
  padding: "var(--cam-space-3)",
  fontSize: "var(--cam-font-size-sm)",
  color: "var(--cam-text-muted)",
};

interface VtTableRendererProps {
  field: OnefopField;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
}

function handleVtGridKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  rIdx: number,
  cIdx: number,
  matrix: string[][],
) {
  let targetRow = rIdx;
  let targetCol = cIdx;

  if (e.key === "ArrowUp") {
    e.preventDefault();
    targetRow = Math.max(0, rIdx - 1);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    targetRow = Math.min(matrix.length - 1, rIdx + 1);
  } else if (e.key === "ArrowLeft") {
    const input = e.currentTarget;
    if (input.selectionStart === 0 && input.selectionEnd === 0) {
      if (cIdx > 0) {
        e.preventDefault();
        targetCol = cIdx - 1;
      }
    } else {
      return;
    }
  } else if (e.key === "ArrowRight") {
    const input = e.currentTarget;
    const len = input.value.length;
    if (input.selectionStart === len && input.selectionEnd === len) {
      if (cIdx < matrix[rIdx].length - 1) {
        e.preventDefault();
        targetCol = cIdx + 1;
      }
    } else {
      return;
    }
  } else {
    return;
  }

  const targetId = matrix[targetRow]?.[targetCol];
  if (targetId && (targetRow !== rIdx || targetCol !== cIdx)) {
    const targetEl = document.getElementById(targetId) as HTMLInputElement | null;
    if (targetEl) {
      targetEl.focus();
      targetEl.select();
    }
  }
}

function VtCellInput({
  cellId,
  rIdx,
  cIdx,
  matrix,
  cellDef,
  value,
  onChange,
  ariaLabel,
}: {
  cellId: string;
  rIdx: number;
  cIdx: number;
  matrix: string[][];
  cellDef: VtCellDef;
  value: unknown;
  onChange: (raw: string) => void;
  /** Readable "Row - Column" name; never expose the technical cell id. */
  ariaLabel: string;
}) {
  const t = useTranslations();
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  if (cellDef.kind === "radioCode" && cellDef.options) {
    return (
      <SelectInput
        id={cellId}
        aria-label={ariaLabel}
        style={{ ...cellInputStyle, width: "auto", minWidth: 90 }}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          —
        </option>
        {cellDef.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {localized(opt.label, locale)}
          </option>
        ))}
      </SelectInput>
    );
  }

  if (cellDef.kind === "boolean") {
    return (
      <SelectInput
        id={cellId}
        aria-label={ariaLabel}
        style={{ ...cellInputStyle, width: "auto", minWidth: 80 }}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          —
        </option>
        <option value="true">{t("vtTableRenderer.booleanYes")}</option>
        <option value="false">{t("vtTableRenderer.booleanNo")}</option>
      </SelectInput>
    );
  }

  if (cellDef.kind === "text") {
    return (
      <TextInput
        id={cellId}
        type="text"
        aria-label={ariaLabel}
        style={{ ...cellInputStyle, width: 140, padding: "0 6px" }}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => handleVtGridKeyDown(e, rIdx, cIdx, matrix)}
      />
    );
  }

  const computed = cellDef.kind === "computed";
  return (
    <NumberInput
      id={cellId}
      type="number"
      min={0}
      aria-label={ariaLabel}
      computed={computed}
      style={{
        ...cellInputStyle,
        // Same look as every other statistical table: number cells are
        // flush with their <td> (no inner box); read-only cells carry the
        // pale success tint on the <td> and a bold success-green figure.
        width: "100%",
        height: 36,
        padding: "0 var(--cam-space-2)",
        border: "none",
        borderRadius: 0,
        background: "transparent",
      }}
      value={(value as string) ?? (computed ? "0" : "")}
      readOnly={computed}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => handleVtGridKeyDown(e, rIdx, cIdx, matrix)}
    />
  );
}

/**
 * Generic high-fidelity renderer for every VT table template:
 * - Sticky headers & sticky row labels
 * - 2D Arrow keyboard navigation across cells
 * - Roster management for progressive / dynamic row reveal
 */
export function VtTableRenderer({ field, data, onChange }: VtTableRendererProps) {
  const t = useTranslations();
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const table = field.table;
  const vt = table?.vt;
  const label = localized(field.label, locale);

  // For roster tables (e.g. Trainers Roster VT8_8), determine visible row count
  const isRoster = vt?.isRoster || vt?.progressiveRows;
  const totalRowsInMatrix = table?.matrix?.length ?? 0;

  // Initialize roster count based on data presence
  const [activeRosterRows, setActiveRosterRows] = useState<number>(() => {
    if (!isRoster || !table?.matrix) return totalRowsInMatrix;
    // Count how many rows have at least one cell populated
    let count = 0;
    for (let r = 0; r < table.matrix.length; r++) {
      const hasAny = table.matrix[r].some((cid) => data[cid] !== undefined && data[cid] !== "" && data[cid] !== null);
      if (hasAny) count = r + 1;
    }
    return Math.max(1, count); // At least 1 row displayed
  });

  if (!table?.matrix || !vt) {
    return (
      <div style={{ marginBottom: "var(--cam-form-gap)" }}>
        <p style={labelStyle}>
          <CodedLabel code={field.paperCode} text={label} />
        </p>
        <div style={placeholderStyle}>
          {t("vtTableRenderer.notYetRendered", { template: table?.template ?? "unknown template", fieldId: field.id })}
        </div>
      </div>
    );
  }

  const matrix = table.matrix;
  const displayedRowCount = isRoster ? Math.min(activeRosterRows, matrix.length) : matrix.length;
  const displayedMatrix = matrix.slice(0, displayedRowCount);
  const cellKinds = vt.cells.map((c) => c.kind);

  const handleCellChange = (rowIdx: number, cellId: string, rawValue: string, kind: string) => {
    if (kind !== "number") {
      onChange(cellId, rawValue);
      return;
    }
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    if (Number.isNaN(parsed)) return;

    const rowIds = matrix[rowIdx];
    const current: CellValues = {};
    for (const id of rowIds) current[id] = Number(data[id] ?? 0);
    current[cellId] = parsed;

    const recalculated = recalculateVtRow(rowIds, cellKinds, current);
    onChange(cellId, String(parsed));
    for (const [id, value] of Object.entries(recalculated)) {
      if (id !== cellId) onChange(id, String(value));
    }
  };

  const addRosterRow = () => {
    if (activeRosterRows < matrix.length) {
      setActiveRosterRows((prev) => prev + 1);
    }
  };

  const removeRosterRow = () => {
    if (activeRosterRows > 1) {
      const lastRowIdx = activeRosterRows - 1;
      const lastRowIds = matrix[lastRowIdx];
      // Clear data for removed row
      for (const id of lastRowIds) {
        onChange(id, "");
      }
      setActiveRosterRows((prev) => prev - 1);
    }
  };

  const displayTitle = localized(vt.title, locale) || label;

  return (
    <div style={{ marginBottom: "var(--cam-form-gap)" }}>
      <p style={labelStyle}>
        <CodedLabel code={field.paperCode} text={displayTitle} />
      </p>

      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--cam-table-frame)",
          borderRadius: "var(--cam-radius-sm)",
        }}
      >
        <DataTable style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", background: "var(--cam-surface)" }}>
          <thead>
            <tr>
              <CornerHeader
                style={{
                  ...thStyle,
                  left: 0,
                  zIndex: 20,
                  borderRight: "2px solid var(--cam-table-group-line)",
                  minWidth: 140,
                }}
              />
              {vt.cells.map((c) => (
                <LeafHeader key={c.key} style={thStyle}>
                  {localized(c.label, locale)}
                </LeafHeader>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedMatrix.map((row, rIdx) => {
              const rowDef = vt.rows[rIdx];
              let rowLabelStr: string = rowDef?.id ?? t("vtTableRenderer.defaultRowLabel", { number: rIdx + 1 });
              if (rowDef?.label) {
                rowLabelStr = localized(rowDef.label, locale);
              } else if (rowDef?.labelFromCells) {
                const composed = rowDef.labelFromCells
                  .map((key) => (data[`${rowDef.id}_${key}`] as string) ?? "")
                  .filter(Boolean)
                  .join(" ");
                if (composed) rowLabelStr = composed;
              }
              // Accessible row name: same as the visible label, except that
              // an unlabelled row says "Row N" instead of its technical id.
              const ariaRowLabel =
                rowLabelStr === rowDef?.id ? t("vtTableRenderer.defaultRowLabel", { number: rIdx + 1 }) : rowLabelStr;
              return (
                <tr key={rIdx}>
                  <RowHeader
                    style={{
                      border: "1px solid var(--cam-table-line)",
                      borderRight: "2px solid var(--cam-table-group-line)",
                      padding: "var(--cam-space-2)",
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      background: "var(--cam-surface)",
                      whiteSpace: "nowrap",
                      boxShadow: "2px 0 4px rgba(0,0,0,0.03)",
                    }}
                  >
                    {rowLabelStr}
                  </RowHeader>
                  {row.map((cellId, cIdx) => (
                    <Cell
                      key={cellId}
                      style={{
                        ...tdStyle,
                        // Number cells sit flush in the cell; selects/text keep padding.
                        padding: vt.cells[cIdx].kind === "computed" || vt.cells[cIdx].kind === "number" ? 0 : tdStyle.padding,
                        background: vt.cells[cIdx].kind === "computed" ? "var(--cam-table-readonly-bg)" : "var(--cam-surface)",
                      }}
                    >
                      <VtCellInput
                        cellId={cellId}
                        rIdx={rIdx}
                        cIdx={cIdx}
                        matrix={displayedMatrix}
                        cellDef={vt.cells[cIdx]}
                        value={data[cellId]}
                        onChange={(raw) => handleCellChange(rIdx, cellId, raw, vt.cells[cIdx].kind)}
                        ariaLabel={tableCellLabel([ariaRowLabel, localized(vt.cells[cIdx].label, locale)], cellId)}
                      />
                    </Cell>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      {isRoster && (
        <div style={{ display: "flex", gap: "var(--cam-space-2)", marginTop: "var(--cam-space-2)" }}>
          {activeRosterRows < matrix.length && (
            <button
              type="button"
              onClick={addRosterRow}
              style={{
                background: "var(--cam-surface)",
                border: "1px solid var(--cam-green)",
                color: "var(--cam-green)",
                borderRadius: "var(--cam-radius-sm)",
                padding: "4px 12px",
                fontSize: "var(--cam-font-size-sm)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("vtTableRenderer.addRowButton", { current: activeRosterRows, total: matrix.length })}
            </button>
          )}
          {activeRosterRows > 1 && (
            <button
              type="button"
              onClick={removeRosterRow}
              style={{
                background: "none",
                border: "1px solid var(--cam-border-strong)",
                color: "var(--cam-text-muted)",
                borderRadius: "var(--cam-radius-sm)",
                padding: "4px 10px",
                fontSize: "var(--cam-font-size-sm)",
                cursor: "pointer",
              }}
            >
              {t("vtTableRenderer.removeRowButton")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
