"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import { ACTIVITIES_ROW_CAPACITY, ACTIVITIES_TABLE_FIELDS } from "@/lib/onefop-activities";
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

// Layout only — typography comes from DataTable (see table/DataTable.tsx).
const thStyle: LayoutStyle = {
  border: "1px solid var(--cam-table-line)",
  padding: "var(--cam-space-2)",
  background: "var(--cam-table-head-bg)",
  color: "var(--cam-table-text)",
  whiteSpace: "nowrap",
};

const tdStyle: LayoutStyle = {
  border: "1px solid var(--cam-table-line)",
  padding: "var(--cam-space-1)",
};

const controlStyle: LayoutStyle = {
  width: "100%",
  minWidth: 120,
  height: 32,
  border: "1px solid var(--cam-border-strong)",
  borderRadius: "var(--cam-radius-sm)",
  padding: "0 var(--cam-space-2)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 600,
  marginBottom: "var(--cam-space-2)",
};

interface ActivitiesTableRendererProps {
  field: OnefopField;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
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
export function ActivitiesTableRenderer({ field, data, onChange }: ActivitiesTableRendererProps) {
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

  const clearRow = (n: number) => {
    for (const id of rowCells(n)) if (entered(id)) onChange(id, "");
    setOpened((o) => o.filter((s) => s !== n));
  };

  return (
    <div style={{ marginBottom: "var(--cam-form-gap)" }}>
      <h2 style={labelStyle}>
        <CodedLabel code={field.paperCode} text={label} />
      </h2>
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
              <LeafHeader style={thStyle}>
                <span className="sr-only">{isEn ? "Action" : "Action"}</span>
              </LeafHeader>
            </tr>
          </thead>
          <tbody>
            {shown.map((n, i) => (
              <tr key={n}>
                <RowHeader style={thStyle}>
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
                          style={controlStyle}
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
                          placeholder={localized(f.hint, locale)}
                          style={{ ...controlStyle, minWidth: f.key === "description" ? 200 : 100 }}
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
                    onClick={() => clearRow(n)}
                    disabled={shown.length === 1 && started.length === 0}
                    aria-label={isEn ? `Clear line ${i + 1}` : `Vider la ligne ${i + 1}`}
                  >
                    {isEn ? "Clear" : "Vider"}
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
