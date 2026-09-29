"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import { ACTIVITIES_ROW_CAPACITY, ACTIVITIES_TABLE_FIELDS } from "@/lib/onefop-activities";
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
  const label = localized(field.label, locale);
  const prefix = field.table?.id ?? field.id;
  const rowCount = field.table?.rowCapacity ?? ACTIVITIES_ROW_CAPACITY;

  return (
    <div style={{ marginBottom: "var(--cam-form-gap)" }}>
      <p style={labelStyle}>
        <CodedLabel code={field.paperCode} text={label} />
        {field.required && ` ${t("activitiesTableRenderer.requiredMarker")}`}
      </p>
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
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, i) => i + 1).map((n) => (
              <tr key={n}>
                <RowHeader style={thStyle}>
                  {n}
                </RowHeader>
                {ACTIVITIES_TABLE_FIELDS.map((f) => {
                  const cellId = `${prefix}_row${n}_${f.key}`;
                  const value = (data[cellId] as string) ?? "";
                  return (
                    <Cell key={f.key} style={tdStyle}>
                      {f.options ? (
                        <SelectInput
                          aria-label={cellId}
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
                          short={f.key !== "description"}
                          type={f.key === "duration" ? "number" : "text"}
                          aria-label={cellId}
                          placeholder={localized(f.hint, locale)}
                          style={{ ...controlStyle, minWidth: f.key === "description" ? 200 : 100 }}
                          value={value}
                          onChange={(e) => onChange(cellId, e.target.value)}
                        />
                      )}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}
