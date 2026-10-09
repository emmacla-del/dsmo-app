"use client";

import { useMemo, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized, tableHasStatusDimension, type LocalizedText } from "@/lib/onefop-schema";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import { tableCellLabel } from "@/lib/table-cell-label";
import {
  AGE_BAND_LABELS,
  DEPARTURE_TYPE_LABELS,
  DIPLOMA_ROW_KEYS,
  DIPLOMA_ROW_LABELS,
  DISMISSAL_TYPE_LABELS,
  GENDER_LABELS,
  INTERNSHIP_ROW_KEYS,
  INTERNSHIP_ROW_LABELS,
  KPI_PERIODS,
  KPI_ROW_KEYS,
  KPI_ROW_LABELS,
  MFT_LABELS,
  REASONS_ROW_KEYS,
  REASONS_ROW_LABELS,
  SKILLS_ROW_KEYS,
  SKILLS_ROW_LABELS,
  STATUS_GENDER_GROUP_LABELS,
  STATUS_LABELS,
  TRAINING_ROW_KEYS,
  TRAINING_ROW_LABELS,
  VULNERABLE_ROW_KEYS,
  VULNERABLE_ROW_LABELS,
  EMBEDDED_ROW_TEXT,
  embeddedRowTextFieldId,
  rowLabel,
} from "@/lib/onefop-tables";
import {
  genderAgeRow,
  genderRow,
  isComputedCspCell,
  recalculateCspGenderAge,
  recalculateCspStatusGender,
  recalculateDeparture,
  recalculateDismissalUnemployment,
  recalculateFirstTimeWorkers,
  recalculateGenderOnly,
  recalculateNone,
  statusGenderRow,
  typeGenderRow,
  type CellValues,
} from "@/lib/onefop-formulas";
import {
  resolveTableScope,
  getModernJobsTableDefinition,
  getGuidedOnlyTableDefinition,
} from "./tables/definitions/modernJobsTableDefinitions";
import { missingQuizFieldKeys } from "./tables/quizRequired";
import { TableCompletionIndicator } from "./tables/TableCompletionIndicator";
import { TABLE_LABEL_COL_PX, TABLE_MAX_WIDTH_PX, tableMinWidthPx } from "./tables/tableLayout";
import { CoherenceChip, CoherenceTd } from "./coherence/Coherence";
import { useCampaignPeriod } from "./CampaignPeriodContext";
import { kpiPeriodLabels } from "@/lib/campaign-period";
import {
  CornerHeader,
  DataTable,
  GroupHeader,
  LeafHeader,
  NumberInput,
  RowCode,
  RowHeader,
  TextInput,
  type LayoutStyle,
} from "./table/DataTable";

/** Editable first column (reason / domain text) for reasons/skills/training tables. */
interface RowTextColumn {
  header: LocalizedText;
  placeholder: LocalizedText;
  /** One AST text field id per body row; undefined for the Total row. */
  fieldIds: (string | undefined)[];
  onTextChange: (fieldId: string, value: string) => void;
}

/** Share of the table width given to an editable text label column. */
const ROW_TEXT_COLUMN_WIDTH = "50%";
/** Minimum width of that column before the table scrolls in its frame. */
const ROW_TEXT_COLUMN_MIN_PX = 260;

const labelStyle: React.CSSProperties = {
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 600,
  marginBottom: "var(--cam-space-2)",
};

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

// Deliberately borderless/flush: the `<td>` already carries the cell's
// border (tdStyle) and the `<colgroup>` in GenericGrid now sets the
// authoritative column width, so the input just fills its cell instead of
// sitting inside a second, separately-bordered box — matching the "plain"
// look of StatisticalGridRenderer's number cells (see that file's `<input>`
// for the same bg-transparent/border-0/w-full/h-full pattern).
const cellInputStyle: LayoutStyle = {
  width: "100%",
  height: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
};

const placeholderStyle: React.CSSProperties = {
  border: "1px dashed var(--cam-border-strong)",
  borderRadius: "var(--cam-radius-sm)",
  padding: "var(--cam-space-3)",
  fontSize: "var(--cam-font-size-sm)",
  color: "var(--cam-text-muted)",
};

interface TableRendererProps {
  field: OnefopField;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
}

/**
 * 2D Keyboard Grid Navigation:
 * Moves focus between matrix cells with ArrowUp / ArrowDown / ArrowLeft / ArrowRight,
 * and intercepts Up/Down on <input type="number"> to prevent unwanted value increments.
 */
function handleGridKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  rIdx: number,
  cIdx: number,
  matrix: string[][],
) {
  let targetRow = rIdx;
  let targetCol = cIdx;

  if (e.key === "Enter") {
    e.preventDefault();
    if (cIdx < matrix[rIdx].length - 1) {
      targetCol = cIdx + 1;
    } else if (rIdx < matrix.length - 1) {
      targetRow = rIdx + 1;
      targetCol = 0;
    }
  } else if (e.key === "ArrowUp") {
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

function CellInput({
  cellId,
  rIdx,
  cIdx,
  matrix,
  data,
  onCellChange,
  tableFieldId,
  missingKeys,
  ariaLabel,
}: {
  cellId: string;
  rIdx: number;
  cIdx: number;
  matrix: string[][];
  data: FormData;
  onCellChange: (cellId: string, rawValue: string) => void;
  tableFieldId?: string;
  missingKeys?: Set<string>;
  /** Readable "Row - Group - Column" name; never expose the technical cell id. */
  ariaLabel: string;
}) {
  // Computed (read-only) cells get the same pale-green "confirmed value"
  // treatment as LiveTablePreview's computed cells, instead of a plain
  // grey fill — consistent with that row's/column's own total styling.
  const computed = isComputedCspCell(cellId);
  const isMissing = !computed && Boolean(missingKeys?.has(cellId));
  return (
    <CoherenceTd
      fieldKey={cellId}
      tableFieldId={tableFieldId}
      hasInput
      style={{
        ...tdStyle,
        background: computed
          ? "var(--cam-table-readonly-bg)"
          : isMissing
            ? "rgba(179, 38, 30, 0.06)"
            : "var(--cam-surface)",
        padding: 0,
      }}
    >
      <NumberInput
        id={cellId}
        data-field-key={cellId}
        type="number"
        min={0}
        aria-label={ariaLabel}
        aria-required={!computed ? "true" : undefined}
        computed={computed}
        style={{
          ...cellInputStyle,
          ...(isMissing ? { outline: "2px solid var(--cam-error)", outlineOffset: "-2px" } : {}),
        }}
        value={(data[cellId] as string) ?? (computed ? "0" : "")}
        readOnly={computed}
        onChange={(e) => onCellChange(cellId, e.target.value)}
        onKeyDown={(e) => handleGridKeyDown(e, rIdx, cIdx, matrix)}
      />
    </CoherenceTd>
  );
}

/** Shared two-level-header grid with frozen sticky header & frozen sticky row headers */
function GenericGrid({
  matrix,
  rowLabels,
  groupLabels,
  subLabels,
  hasTotalRow = true,
  data,
  onCellChange,
  rowText,
  tableFieldId,
  missingKeys,
}: {
  matrix: string[][];
  rowLabels: LocalizedText[];
  groupLabels: LocalizedText[];
  subLabels: LocalizedText[];
  hasTotalRow?: boolean;
  data: FormData;
  onCellChange: (cellId: string, rawValue: string) => void;
  rowText?: RowTextColumn;
  tableFieldId?: string;
  missingKeys?: Set<string>;
}) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  // Leaf column count: one M/F/Total-style sub-column per group (or just
  // subLabels when there is a single, unlabeled group).
  const leafColumnCount = groupLabels.length * subLabels.length;

  const minTableWidth = rowText
    ? ROW_TEXT_COLUMN_MIN_PX + tableMinWidthPx(leafColumnCount, 0)
    : tableMinWidthPx(leafColumnCount);

  return (
    // Same sizing rule as StatisticalGridRenderer (see tables/tableLayout.ts):
    // the frame fills its container up to TABLE_MAX_WIDTH_PX so every table
    // lines up; the label column is fixed and the data columns share the
    // rest equally. It only scrolls (inside this frame) once data columns
    // would drop below TABLE_MIN_DATA_COL_PX.
    <div
      style={{
        width: "100%",
        maxWidth: TABLE_MAX_WIDTH_PX,
        overflow: "hidden",
        border: "1px solid var(--cam-table-frame)",
        borderRadius: "var(--cam-radius-sm)",
      }}
    >
      <div style={{ width: "100%", overflow: "auto", maxHeight: "75vh" }}>
        <DataTable
          style={{
            width: "100%",
            minWidth: minTableWidth,
            borderCollapse: "separate",
            borderSpacing: 0,
            tableLayout: "fixed",
            background: "var(--cam-surface)",
          }}
        >
          <colgroup>
            <col style={{ width: rowText ? ROW_TEXT_COLUMN_WIDTH : TABLE_LABEL_COL_PX }} />
            {Array.from({ length: leafColumnCount }).map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
        <thead>
          {groupLabels.length > 1 && (
            <tr>
              <CornerHeader
                rowSpan={2}
                style={{
                  ...thStyle,
                  left: 0,
                  zIndex: 20,
                  borderRight: "1px solid var(--cam-table-line)",
                }}
              />
              {groupLabels.map((g, i) => (
                <GroupHeader key={`${g.fr}-${i}`} colSpan={subLabels.length} style={thStyle}>
                  {localized(g, locale)}
                </GroupHeader>
              ))}
            </tr>
          )}
          <tr>
            {groupLabels.length === 1 && (
              <CornerHeader
                style={{
                  ...thStyle,
                  left: 0,
                  zIndex: 20,
                  borderRight: "1px solid var(--cam-table-line)",
                }}
              >
                {rowText ? localized(rowText.header, locale) : null}
              </CornerHeader>
            )}
            {groupLabels.flatMap((g, gi) =>
              subLabels.map((s, si) => (
                <LeafHeader key={`${gi}-${si}`} style={thStyle}>
                  {localized(s, locale)}
                </LeafHeader>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rIdx) => {
            const isTotal = hasTotalRow && rIdx === matrix.length - 1;
            const textFieldId = !isTotal ? rowText?.fieldIds[rIdx] : undefined;
            const ariaRowLabel =
              textFieldId && rowText
                ? `${localized(rowText.header, locale)} ${rIdx + 1}`
                : rowLabels[rIdx]
                  ? localized(rowLabels[rIdx], locale)
                  : undefined;
            // Total row uses the same pale-green "confirmed total" treatment
            // as LiveTablePreview's grand-total row (var(--cam-success-bg) /
            // var(--cam-success-border)), instead of a plain grey band — the
            // same visual language the other Guided/preview tables already use.
            return (
              <tr
                key={rIdx}
                style={{
                  background: isTotal ? "var(--cam-table-readonly-bg)" : undefined,
                  borderBottom: isTotal ? "2px solid var(--cam-table-strong)" : undefined,
                }}
              >
                <RowHeader
                  total={isTotal}
                  style={{
                    border: "1px solid var(--cam-table-line)",
                    padding: textFieldId ? 0 : "var(--cam-space-2)",
                    position: "sticky",
                    left: 0,
                    zIndex: 5,
                    background: isTotal ? "var(--cam-table-readonly-bg)" : "var(--cam-surface)",
                  }}
                >
                  {textFieldId && rowText ? (
                    <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                      <span aria-hidden="true" style={{ flex: "none", width: 26, paddingLeft: "var(--cam-space-2)" }}>
                        <RowCode>{rIdx + 1}</RowCode>
                      </span>
                      <TextInput
                        id={textFieldId}
                        name={textFieldId}
                        type="text"
                        aria-label={`${localized(rowText.header, locale)} ${rIdx + 1}`}
                        placeholder={localized(rowText.placeholder, locale)}
                        value={(data[textFieldId] as string | undefined) ?? ""}
                        onChange={(e) => rowText.onTextChange(textFieldId, e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 36,
                          padding: "0 var(--cam-space-2)",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                        }}
                      />
                    </div>
                  ) : (
                    localized(rowLabels[rIdx], locale)
                  )}
                </RowHeader>
                {row.map((cellId, cIdx) => {
                  // Leaf columns run group-major: subLabels repeat per group.
                  const group = groupLabels.length > 1 ? groupLabels[Math.floor(cIdx / subLabels.length)] : undefined;
                  const sub = subLabels[cIdx % subLabels.length];
                  return (
                    <CellInput
                      key={cellId}
                      cellId={cellId}
                      rIdx={rIdx}
                      cIdx={cIdx}
                      matrix={matrix}
                      data={data}
                      onCellChange={onCellChange}
                      tableFieldId={tableFieldId}
                      missingKeys={missingKeys}
                      ariaLabel={tableCellLabel(
                        [
                          ariaRowLabel,
                          group ? localized(group, locale) : undefined,
                          sub ? localized(sub, locale) : undefined,
                        ],
                        cellId,
                      )}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        </DataTable>
      </div>
    </div>
  );
}

/** first_time_workers_table's shape with frozen leading columns and sticky header */
function ContractGroupedGrid({
  matrix,
  rowKeys,
  data,
  onCellChange,
  activeAgeIndices = [0, 1, 2, 3],
  contracts = ["permanent", "temporary"],
  missingKeys,
  tableFieldId,
}: {
  matrix: string[][];
  rowKeys: string[];
  data: FormData;
  onCellChange: (cellId: string, rawValue: string) => void;
  activeAgeIndices?: number[];
  contracts?: string[];
  missingKeys?: Set<string>;
  tableFieldId?: string;
}) {
  const t = useTranslations();
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const blockSize = rowKeys.length + 1;

  return (
    <div
      style={{
        overflowX: "auto",
        maxHeight: "75vh",
        border: "1px solid var(--cam-table-frame)",
        borderRadius: "var(--cam-radius-sm)",
      }}
    >
      <DataTable style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", background: "var(--cam-surface)" }}>
        <thead>
          <tr>
            <CornerHeader
              colSpan={2}
              rowSpan={2}
              style={{
                ...thStyle,
                left: 0,
                zIndex: 20,
                borderRight: "2px solid var(--cam-table-group-line)",
              }}
            />
            {GENDER_LABELS.map((g) => (
              <GroupHeader key={g.fr} colSpan={activeAgeIndices.length} style={thStyle}>
                {localized(g, locale)}
              </GroupHeader>
            ))}
          </tr>
          <tr>
            {GENDER_LABELS.flatMap((g) =>
              activeAgeIndices.map((aIdx) => (
                <LeafHeader key={`${g.fr}-${AGE_BAND_LABELS[aIdx].fr}`} style={thStyle}>
                  {localized(AGE_BAND_LABELS[aIdx], locale)}
                </LeafHeader>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rIdx) => {
            const blockIdx = Math.floor(rIdx / blockSize);
            const posInBlock = rIdx % blockSize;
            const isTotalRow = posInBlock === rowKeys.length;
            const totalLabelText = t("tableRenderer.totalRowLabelTitleCase");
            const label = isTotalRow ? { fr: totalLabelText, en: totalLabelText } : rowLabel(rowKeys[posInBlock]);
            const currentContract = contracts[blockIdx] ?? "permanent";
            const contractLabel = currentContract === "permanent" ? STATUS_LABELS[0] : STATUS_LABELS[1];
            return (
              <tr key={rIdx} style={{ background: isTotalRow ? "var(--cam-table-readonly-bg)" : undefined }}>
                {posInBlock === 0 && (
                  <RowHeader
                    block
                    rowSpan={blockSize}
                    style={{
                      border: "1px solid var(--cam-table-line)",
                      padding: "var(--cam-space-2)",
                      position: "sticky",
                      left: 0,
                      zIndex: 6,
                      background: "var(--cam-surface)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {localized(contractLabel, locale)}
                  </RowHeader>
                )}
                <RowHeader
                  total={isTotalRow}
                  style={{
                    border: "1px solid var(--cam-table-line)",
                    borderRight: "2px solid var(--cam-table-group-line)",
                    padding: "var(--cam-space-2)",
                    position: "sticky",
                    left: 100,
                    zIndex: 5,
                    background: isTotalRow ? "var(--cam-table-readonly-bg)" : "var(--cam-surface)",
                    whiteSpace: "nowrap",
                    boxShadow: "2px 0 4px rgba(0,0,0,0.03)",
                  }}
                >
                  {localized(label, locale)}
                </RowHeader>
                {row.map((cellId, cIdx) => {
                  // Leaf columns run gender-major: the active age bands repeat per gender.
                  const ageCount = activeAgeIndices.length;
                  const gender = ageCount > 0 ? GENDER_LABELS[Math.floor(cIdx / ageCount)] : undefined;
                  const age = ageCount > 0 ? AGE_BAND_LABELS[activeAgeIndices[cIdx % ageCount]] : undefined;
                  return (
                    <CellInput
                      key={cellId}
                      cellId={cellId}
                      rIdx={rIdx}
                      cIdx={cIdx}
                      matrix={matrix}
                      data={data}
                      onCellChange={onCellChange}
                      tableFieldId={tableFieldId}
                      missingKeys={missingKeys}
                      ariaLabel={tableCellLabel(
                        [
                          localized(contractLabel, locale),
                          localized(label, locale),
                          gender ? localized(gender, locale) : undefined,
                          age ? localized(age, locale) : undefined,
                        ],
                        cellId,
                      )}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </div>
  );
}

type TableConfig = {
  rows: string[];
  rowLabels: LocalizedText[];
  buildMatrix: (rows: string[]) => string[][];
  groupLabels: LocalizedText[];
  subLabels: LocalizedText[];
  recalc: (c: CellValues, p: string, r: string[]) => CellValues;
  hasTotalRow?: boolean;
};

export function TableRenderer({ field, data, onChange }: TableRendererProps) {
  const t = useTranslations();
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const campaignPeriod = useCampaignPeriod();
  const table = field.table;
  const label = localized(field.label, locale);
  const cspRows = table?.rowKeys && table.rowKeys.length > 0 ? table.rowKeys : ["cadres", "foremen", "workers"];

  const fieldId = field.id;
  const cleanId = fieldId.replace(/^FIELD_/i, "");
  const responseStatus =
    data[`${fieldId}_RESPONSE_STATUS`] ??
    data[`${fieldId.toUpperCase()}_RESPONSE_STATUS`] ??
    data[`${fieldId.toLowerCase()}_RESPONSE_STATUS`] ??
    data[`${cleanId}_RESPONSE_STATUS`] ??
    data[`${cleanId.toUpperCase()}_RESPONSE_STATUS`] ??
    (field.paperCode ? data[`${field.paperCode}_RESPONSE_STATUS`] : undefined) ??
    (field.paperCode ? data[`${field.paperCode.toUpperCase()}_RESPONSE_STATUS`] : undefined);

  const isReported =
    responseStatus === "REPORTED" ||
    (!responseStatus && !data._scopeConfig);

  const definition = useMemo(
    () => getModernJobsTableDefinition(field, data) ?? getGuidedOnlyTableDefinition(field, data),
    [field, data]
  );

  const missingFieldKeys = useMemo(
    () => (isReported && definition ? missingQuizFieldKeys(definition, data) : []),
    [isReported, definition, data]
  );
  const missingKeysSet = useMemo(() => new Set(missingFieldKeys), [missingFieldKeys]);

  const handleFocusFirstIncomplete = () => {
    if (missingFieldKeys.length === 0) return;
    const firstKey = missingFieldKeys[0];
    const el =
      document.querySelector<HTMLInputElement>(`input[data-field-key="${firstKey}"]`) ||
      document.getElementById(firstKey);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
      (el as HTMLInputElement).select?.();
    }
  };

  const config: TableConfig | undefined = (() => {
    switch (table?.template) {
      case "csp_gender_age_table": {
        const { activeAgeIndices, cspRows: filteredCsp } = resolveTableScope(field, data, cspRows);
        const subLabels = activeAgeIndices.map((i) => AGE_BAND_LABELS[i]);
        const buildFilteredRow = (r: string) => {
          const full = genderAgeRow(table.id, r);
          const filtered: string[] = [];
          [0, 1, 2].forEach((gIdx) => {
            activeAgeIndices.forEach((aIdx) => {
              filtered.push(full[gIdx * 4 + aIdx]);
            });
          });
          return filtered;
        };

        return {
          rows: filteredCsp,
          rowLabels: [
            ...filteredCsp.map(rowLabel),
            { fr: t("tableRenderer.totalRowLabelUpper"), en: t("tableRenderer.totalRowLabelUpper") },
          ],
          buildMatrix: (rows) => [
            ...rows.map((r) => buildFilteredRow(r)),
            buildFilteredRow("total"),
          ],
          groupLabels: GENDER_LABELS,
          subLabels,
          recalc: recalculateCspGenderAge,
        };
      }
      case "diploma_gender_age_table": {
        const { activeAgeIndices } = resolveTableScope(field, data);
        const subLabels = activeAgeIndices.map((i) => AGE_BAND_LABELS[i]);
        const scopedDiplomas = (data?._scopeConfig as Record<string, any>)?.recruit_diploma;
        const activeDiplomaKeys = Array.isArray(scopedDiplomas) && scopedDiplomas.length > 0
          ? DIPLOMA_ROW_KEYS.filter((k) => scopedDiplomas.includes(k))
          : DIPLOMA_ROW_KEYS;
        const activeDiplomaLabels = activeDiplomaKeys.map((k) => {
          const idx = DIPLOMA_ROW_KEYS.indexOf(k);
          return DIPLOMA_ROW_LABELS[idx];
        });

        const buildFilteredRow = (dKey: string) => {
          const full = genderAgeRow(table.id, dKey);
          const filtered: string[] = [];
          [0, 1, 2].forEach((gIdx) => {
            activeAgeIndices.forEach((aIdx) => {
              filtered.push(full[gIdx * 4 + aIdx]);
            });
          });
          return filtered;
        };

        return {
          rows: activeDiplomaKeys,
          rowLabels: [...activeDiplomaLabels, { fr: "TOTAL", en: "TOTAL" }],
          buildMatrix: (rows) => [
            ...rows.map((r) => buildFilteredRow(r)),
            buildFilteredRow("total"),
          ],
          groupLabels: GENDER_LABELS,
          subLabels,
          recalc: recalculateCspGenderAge,
        };
      }
      case "csp_status_gender_table": {
        const { cspRows: filteredCsp } = resolveTableScope(field, data, cspRows);
        if (!tableHasStatusDimension(table)) {
          // Administration S21Q03: catégorie × sexe, no permanent/temporary.
          return {
            rows: filteredCsp,
            rowLabels: [...filteredCsp.map(rowLabel), { fr: "TOTAL", en: "TOTAL" }],
            buildMatrix: (rows) => [...rows.map((r) => genderRow(table.id, r)), genderRow(table.id, "total")],
            groupLabels: [{ fr: "", en: "" }],
            subLabels: MFT_LABELS,
            recalc: recalculateGenderOnly,
          };
        }
        return {
          rows: filteredCsp,
          rowLabels: [...filteredCsp.map(rowLabel), { fr: "TOTAL", en: "TOTAL" }],
          buildMatrix: (rows) => [
            ...rows.map((r) => statusGenderRow(table.id, r)),
            statusGenderRow(table.id, "total"),
          ],
          groupLabels: STATUS_GENDER_GROUP_LABELS,
          subLabels: MFT_LABELS,
          recalc: recalculateCspStatusGender,
        };
      }
      case "vulnerable_named_rows_table":
        if (!tableHasStatusDimension(table)) {
          // Administration S21Q04: nature de la vulnérabilité × sexe.
          return {
            rows: VULNERABLE_ROW_KEYS,
            rowLabels: [...VULNERABLE_ROW_LABELS, { fr: "TOTAL", en: "TOTAL" }],
            buildMatrix: (rows) => [...rows.map((r) => genderRow(table.id, r)), genderRow(table.id, "total")],
            groupLabels: [{ fr: "", en: "" }],
            subLabels: MFT_LABELS,
            recalc: recalculateGenderOnly,
          };
        }
        return {
          rows: VULNERABLE_ROW_KEYS,
          rowLabels: [...VULNERABLE_ROW_LABELS, { fr: "TOTAL", en: "TOTAL" }],
          buildMatrix: (rows) => [
            ...rows.map((r) => statusGenderRow(table.id, r)),
            statusGenderRow(table.id, "total"),
          ],
          groupLabels: STATUS_GENDER_GROUP_LABELS,
          subLabels: MFT_LABELS,
          recalc: recalculateCspStatusGender,
        };
      case "departure_table": {
        const { cspRows: filteredCsp } = resolveTableScope(field, data, cspRows);
        const scopeConfig = data?._scopeConfig as Record<string, any> | undefined;
        const reasons = scopeConfig?.departure_reasons as string[] | undefined;
        const reasonMap: Record<string, string> = {
          licenciement: "dismissal",
          demission: "resignation",
          retraite: "retirement",
          autre: "other",
        };
        const allDepartureTypes = ["dismissal", "resignation", "retirement", "other", "ensemble"];
        const departureTypes = Array.isArray(reasons) && reasons.length > 0
          ? allDepartureTypes.filter((t) => t === "ensemble" || reasons.some((r) => reasonMap[r] === t))
          : allDepartureTypes;
        const filteredGroupLabels = departureTypes.map((dt) => {
          const origIdx = allDepartureTypes.indexOf(dt);
          return DEPARTURE_TYPE_LABELS[origIdx];
        });

        return {
          rows: filteredCsp,
          rowLabels: [...filteredCsp.map(rowLabel), { fr: "TOTAL", en: "TOTAL" }],
          buildMatrix: (rows) => [
            ...rows.map((r) => typeGenderRow(table.id, r, departureTypes)),
            typeGenderRow(table.id, "total", departureTypes),
          ],
          groupLabels: filteredGroupLabels,
          subLabels: MFT_LABELS,
          recalc: recalculateDeparture,
        };
      }
      case "dismissal_unemployment_table": {
        const { cspRows: filteredCsp } = resolveTableScope(field, data, cspRows);
        return {
          rows: filteredCsp,
          rowLabels: [...filteredCsp.map(rowLabel), { fr: "TOTAL", en: "TOTAL" }],
          buildMatrix: (rows) => [
            ...rows.map((r) => typeGenderRow(table.id, r, ["dismissal", "technical_unemployment", "total"])),
            typeGenderRow(table.id, "total", ["dismissal", "technical_unemployment", "total"]),
          ],
          groupLabels: DISMISSAL_TYPE_LABELS,
          subLabels: MFT_LABELS,
          recalc: recalculateDismissalUnemployment,
        };
      }
      case "internship_table": {
        const scopeConfig = data?._scopeConfig as Record<string, any> | undefined;
        const internTypes = scopeConfig?.intern_types as string[] | undefined;
        const internMap: Record<string, string> = {
          vacance: "vacation",
          academique: "academic",
          professionnel: "professional",
          preemploi: "pre_employment",
        };
        const activeInternKeys = Array.isArray(internTypes) && internTypes.length > 0
          ? INTERNSHIP_ROW_KEYS.filter((k) => internTypes.some((t) => internMap[t] === k))
          : INTERNSHIP_ROW_KEYS;
        const rows = activeInternKeys.length > 0 ? activeInternKeys : INTERNSHIP_ROW_KEYS;
        const activeInternLabels = rows.map((k) => {
          const idx = INTERNSHIP_ROW_KEYS.indexOf(k);
          return INTERNSHIP_ROW_LABELS[idx];
        });

        return {
          rows,
          rowLabels: [...activeInternLabels, { fr: "Total", en: "Total" }],
          buildMatrix: (rws) => [...rws.map((r) => genderRow(table.id, r)), genderRow(table.id, "total")],
          groupLabels: [{ fr: "", en: "" }],
          subLabels: MFT_LABELS,
          recalc: recalculateGenderOnly,
        };
      }
      case "reasons_table":
        return {
          rows: REASONS_ROW_KEYS,
          rowLabels: [...REASONS_ROW_LABELS, { fr: "Total", en: "Total" }],
          buildMatrix: (rows) => [...rows.map((r) => genderRow(table.id, r)), genderRow(table.id, "total")],
          groupLabels: [{ fr: "", en: "" }],
          subLabels: MFT_LABELS,
          recalc: recalculateGenderOnly,
        };
      case "skills_table":
        return {
          rows: SKILLS_ROW_KEYS,
          rowLabels: [...SKILLS_ROW_LABELS, { fr: "Total", en: "Total" }],
          buildMatrix: (rows) => [...rows.map((r) => genderRow(table.id, r)), genderRow(table.id, "total")],
          groupLabels: [{ fr: "", en: "" }],
          subLabels: MFT_LABELS,
          recalc: recalculateGenderOnly,
        };
      case "training_table":
        return {
          rows: TRAINING_ROW_KEYS,
          rowLabels: [...TRAINING_ROW_LABELS, { fr: "Total", en: "Total" }],
          buildMatrix: (rows) => [...rows.map((r) => genderRow(table.id, r)), genderRow(table.id, "total")],
          groupLabels: [{ fr: "", en: "" }],
          subLabels: MFT_LABELS,
          recalc: recalculateGenderOnly,
        };
      case "kpi_period_table":
        return {
          rows: KPI_ROW_KEYS,
          rowLabels: KPI_ROW_LABELS,
          buildMatrix: (rows) => rows.map((r) => KPI_PERIODS.map((p) => `${table.id}_${r}_${p}`)),
          groupLabels: [{ fr: "", en: "" }],
          subLabels: kpiPeriodLabels(campaignPeriod),
          recalc: recalculateNone,
          hasTotalRow: false,
        };
      default:
        return undefined;
    }
  })();

  if (!table || table.template !== "first_time_workers_table") {
    if (!table || !config) {
      return (
        <div style={{ marginBottom: "var(--cam-form-gap)" }}>
          <p style={labelStyle}>
            <CodedLabel code={field.paperCode} text={label} />
            {field.required && " *"}
          </p>
          <div style={placeholderStyle}>
            {t("tableRenderer.tableNotYetRendered", { template: table?.template ?? "unknown template", fieldId: field.id })}
          </div>
        </div>
      );
    }

    const matrix = config.buildMatrix(config.rows);
    const prefix = table.id;

    // reasons/skills/training: the first column is the row's reason/domain
    // text, bound to the AST's own S3Q02_REASON_n_TEXT / S4Q0x_DOMAIN_n_TEXT
    // fields (same keys as before — only where they are typed changes).
    const embedded = table.template ? EMBEDDED_ROW_TEXT[table.template] : undefined;
    const rowTextColumn: RowTextColumn | undefined =
      embedded && table.template
        ? {
            header: embedded.header,
            placeholder: embedded.placeholder,
            fieldIds: config.rows.map((_, i) => embeddedRowTextFieldId(table.id, table.template!, i + 1)),
            onTextChange: (fieldId, value) => onChange(fieldId, value),
          }
        : undefined;

    const handleCellChange = (cellId: string, rawValue: string) => {
      // T4: blank is system-missing, not zero — keep distinct from explicit 0
      const isBlank = rawValue === "";
      const parsed = isBlank ? NaN : Number(rawValue);
      if (!isBlank && Number.isNaN(parsed)) return;

      const current: CellValues = {};
      for (const row of matrix) for (const id of row) {
        const v = data[id];
        // T4: absent/blank cell → NaN so totals propagate blank rather than
        // treating an unentered sibling as zero.
        current[id] = v !== undefined && v !== null && v !== "" ? Number(v) : NaN;
      }
      current[cellId] = parsed;

      const recalculated = config.recalc(current, prefix, config.rows);
      // S6 fix: store numeric values as JS numbers, not strings.
      onChange(cellId, isBlank ? "" : parsed);
      for (const [id, value] of Object.entries(recalculated)) {
        // T4: if any constituent cell is blank the total is blank (NaN → "").
        if (isComputedCspCell(id)) onChange(id, Number.isNaN(value) ? "" : value);
      }
    };

    return (
      <div style={{ marginBottom: "var(--cam-form-gap)" }}>
        <p style={labelStyle}>
          <CodedLabel code={field.paperCode} text={label} />
          {field.required && " *"}
        </p>
        <CoherenceChip tableFieldId={field.id} style={{ marginBottom: "var(--cam-space-2)" }} />
        {isReported && missingFieldKeys.length > 0 && (
          <TableCompletionIndicator
            missingCount={missingFieldKeys.length}
            onFocusFirstMissing={handleFocusFirstIncomplete}
            locale={locale}
          />
        )}
        <GenericGrid
          matrix={matrix}
          rowLabels={config.rowLabels}
          groupLabels={config.groupLabels}
          subLabels={config.subLabels}
          hasTotalRow={config.hasTotalRow}
          data={data}
          onCellChange={handleCellChange}
          rowText={rowTextColumn}
          tableFieldId={field.id}
          missingKeys={missingKeysSet}
        />
      </div>
    );
  }

  // first_time_workers_table
  const { activeAgeIndices, cspRows: filteredRows } = resolveTableScope(field, data, cspRows);
  const scopeConfig = data?._scopeConfig as Record<string, any> | undefined;
  const scopedTypes = scopeConfig?.primo_workers_types;
  const rawContracts = Array.isArray(scopedTypes) && scopedTypes.length > 0
    ? ["permanent", "temporary"].filter((c) =>
        scopedTypes.includes(c === "temporary" ? "temporaire" : c)
      )
    : ["permanent", "temporary"];
  const contracts = rawContracts.length > 0 ? rawContracts : ["permanent", "temporary"];

  const buildFtwRow = (rowKey: string) => {
    const full = genderAgeRow(table.id, rowKey);
    const filtered: string[] = [];
    [0, 1, 2].forEach((gIdx) => {
      activeAgeIndices.forEach((aIdx) => {
        filtered.push(full[gIdx * 4 + aIdx]);
      });
    });
    return filtered;
  };

  const rows = filteredRows;
  const prefix = table.id;
  const matrix: string[][] = [];
  for (const contract of contracts) {
    for (const r of rows) matrix.push(buildFtwRow(`${contract}_${r}`));
    matrix.push(buildFtwRow(`${contract}_total`));
  }

  const handleFtwChange = (cellId: string, rawValue: string) => {
    // T4: blank is system-missing, not zero
    const isBlank = rawValue === "";
    const parsed = isBlank ? NaN : Number(rawValue);
    if (!isBlank && Number.isNaN(parsed)) return;

    const current: CellValues = {};
    for (const row of matrix) for (const id of row) {
      const v = data[id];
      current[id] = v !== undefined && v !== null && v !== "" ? Number(v) : NaN;
    }
    current[cellId] = parsed;

    const recalculated = recalculateFirstTimeWorkers(current, prefix, rows);
    onChange(cellId, isBlank ? "" : parsed);
    for (const [id, value] of Object.entries(recalculated)) {
      if (isComputedCspCell(id)) onChange(id, Number.isNaN(value) ? "" : value);
    }
  };

  return (
    <div style={{ marginBottom: "var(--cam-form-gap)" }}>
      <p style={labelStyle}>
        <CodedLabel code={field.paperCode} text={label} />
        {field.required && " *"}
      </p>
      {isReported && missingFieldKeys.length > 0 && (
        <TableCompletionIndicator
          missingCount={missingFieldKeys.length}
          onFocusFirstMissing={handleFocusFirstIncomplete}
          locale={locale}
        />
      )}
      <ContractGroupedGrid
        matrix={matrix}
        rowKeys={rows}
        data={data}
        onCellChange={handleFtwChange}
        activeAgeIndices={activeAgeIndices}
        contracts={contracts}
        missingKeys={missingKeysSet}
        tableFieldId={field.id}
      />
    </div>
  );
}
