"use client";

// Tableau view for the VT tables whose rows the respondent adds: a specialty
// typed in the first column, then counts (4.3–4.6, 4.10, 6.3, 8.4, 8.7) or
// Yes/No answers (5.2). The schema gives each table fixed row slots
// (s4q3_row1_… to s4q3_row12_…); this grid writes exactly the cells the
// row-by-row entry (VtWizardProgressiveGuidedTableEntry, and
// VtWizardProgressiveBooleanTableEntry for 5.2) writes, so the two modes
// share data.
//
// A slot is shown once any of its cells is filled — the rule
// missingVtTableCells uses to decide which rows must be complete — so a row
// typed in either mode is never hidden in the other. "Add a specialty" shows
// the next free slot; "Remove" clears every cell of its slot (the slot is
// then free again, as in the row-by-row entry). Unanswered stays unanswered:
// clearing a number stores nothing, never 0, and a Yes/No cell keeps a
// "Sans réponse" option of its own, distinct from Non (§9).
//
// A Yes/No cell that depends on another (5.2's "Le référentiel est-il
// homologué ?" on "Existence d'un référentiel") applies only while its
// parent answer is Yes — the same gate validation applies (isTrue in
// vt-quiz.ts) — and answering the parent anything else clears it.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, LocalizedText, OnefopField, VtCellDef } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { isTrue } from "@/lib/vt-quiz";
import {
  TABLE_LABEL_COL_PX,
  TABLE_MAX_DATA_COL_PX,
  spanningHeadingsOf,
  tableDataColumnWidthPx,
  TABLE_MAX_WIDTH_PX,
  tablePreferredWidthPx,
} from "./tableLayout";
import {
  Cell,
  CellValue,
  CornerHeader,
  DataTable,
  GroupHeader,
  LeafHeader,
  NumberInput,
  RowHeader,
  SelectInput,
  TextInput,
} from "../table/DataTable";

const GROUP_SEPARATOR = " — ";

/** Width a Yes/No column needs before the table scrolls inside its frame. */
const BOOLEAN_COL_PX = 140;

/** Paper abbreviations used as group names, spelled out for respondents. */
const GROUP_NAMES: Record<string, LocalizedText> = {
  FI: { fr: "Formation initiale", en: "Initial training" },
  IT: { fr: "Formation initiale", en: "Initial training" },
  FC: { fr: "Formation continue", en: "Continuing training" },
  CT: { fr: "Formation continue", en: "Continuing training" },
};

/**
 * True for the add-a-row tables made of one text cell then counts, possibly
 * with a calculated total (4.3–4.6, 4.10, 6.3, 8.4, 8.7), or Yes/No answers
 * (5.2).
 */
export function isVtProgressiveRowTable(field: OnefopField): boolean {
  const vt = field.table?.vt;
  if (!vt || !vt.progressiveRows || vt.isRoster || !field.table?.matrix?.length) return false;
  const [first, ...rest] = vt.cells;
  return (
    first?.kind === "text" &&
    rest.some((c) => c.kind === "number" || c.kind === "boolean") &&
    rest.every((c) => c.kind === "number" || c.kind === "computed" || c.kind === "boolean")
  );
}

const entered = (v: unknown) => v !== undefined && v !== null && v !== "";

/**
 * Slots with at least one cell filled, in slot order. A calculated cell does
 * not count: the same rule as validation (missingVtTableCells).
 */
export function vtStartedSlots(field: OnefopField, data: FormData): number[] {
  const matrix = field.table?.matrix ?? [];
  const cells = field.table?.vt?.cells ?? [];
  return matrix.flatMap((ids, i) =>
    ids.some((id, c) => cells[c]?.kind !== "computed" && entered(data[id])) ? [i] : [],
  );
}

/** The slot "Add" fills: the first free one after the last used, else the first free gap. */
export function vtNextFreeSlot(field: OnefopField, used: ReadonlySet<number>): number | null {
  const count = field.table?.matrix?.length ?? 0;
  const last = Math.max(-1, ...used);
  for (let i = last + 1; i < count; i++) if (!used.has(i)) return i;
  for (let i = 0; i < count; i++) if (!used.has(i)) return i;
  return null;
}

/**
 * A cell label with its paper abbreviation spelled out ("IT — Men" →
 * "Initial training — Men"), for a label read on its own, as in Guidé.
 */
export function vtSpelledOutCellLabel(label: LocalizedText | null | undefined, locale: "fr" | "en"): string {
  const { group, header } = splitHeader(label, locale);
  return group ? `${group}${GROUP_SEPARATOR}${header}` : header;
}

/** "Initial Training (IT)" / "Formation Initiale (FI)" as a column of its
 *  own (8.7), worded like the same group elsewhere (8.4): "Initial training". */
function spelledTrainingType(text: string, locale: "fr" | "en"): string {
  const abbr = /\((FI|IT|FC|CT)\)\s*$/.exec(text)?.[1];
  return abbr ? localized(GROUP_NAMES[abbr], locale) : text;
}

function splitHeader(label: LocalizedText | null | undefined, locale: "fr" | "en") {
  const text = label ? localized(label, locale) : "";
  const parts = text.split(GROUP_SEPARATOR);
  if (parts.length !== 2) return { group: null, header: spelledTrainingType(text, locale) };
  const name = GROUP_NAMES[parts[0].trim()];
  return { group: name ? localized(name, locale) : parts[0], header: parts[1] };
}

export function VtProgressiveRowGrid({
  field,
  data,
  onChange,
  missingCells,
}: {
  field: OnefopField;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
  /** Cells to mark, once a blocked Suivant is showing the table's problems. */
  missingCells?: string[];
}) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const isEn = locale === "en";
  const t = useTranslations();
  const vt = field.table!.vt!;
  const matrix = field.table!.matrix!;
  // Count columns, a calculated total (4.10, 6.3) shown as each row's sum,
  // and Yes/No columns (5.2). The total is saved for the whole declaration by
  // useVtFixedRowTotals, by the same rule as shown here.
  const [labelCell, ...valueCells] = vt.cells;
  const isComputed = (j: number) => valueCells[j].kind === "computed";
  const isCount = (j: number) => valueCells[j].kind === "number";
  const isBoolean = (j: number) => valueCells[j].kind === "boolean";
  // 5.2 has no count at all, so no Total row; a mixed table would total only
  // its count columns.
  const hasTotals = valueCells.some((c) => c.kind === "number" || c.kind === "computed");

  // Slots opened with "Add" but not typed in yet (not stored anywhere).
  const [opened, setOpened] = useState<number[]>([]);
  // The slot whose specialty input takes focus once "Add" has rendered it.
  const focusSlot = useRef<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const started = vtStartedSlots(field, data);
  const shownSet = new Set([...started, ...opened]);
  // An empty table offers its first line straight away, like the paper form.
  if (shownSet.size === 0) shownSet.add(0);
  const shown = [...shownSet].sort((a, b) => a - b);
  const next = vtNextFreeSlot(field, shownSet);

  useEffect(() => {
    if (focusSlot.current === null) return;
    document.getElementById(`cell-input-${matrix[focusSlot.current][0]}`)?.focus();
    focusSlot.current = null;
  });

  const add = () => {
    if (next === null) return;
    focusSlot.current = next;
    // Every slot on screen stays open, the empty first line included: it is
    // shown without being opened, and would vanish once another slot is.
    setOpened((o) => [...new Set([...o, ...shown, next])]);
  };

  const remove = (slot: number) => {
    for (const id of matrix[slot]) if (entered(data[id])) onChange(id, null);
    setOpened((o) => o.filter((s) => s !== slot));
  };

  // A Yes/No cell applies unless the answer it depends on is not Yes — the
  // gate missingVtTableCells applies, so the grid never asks for a cell
  // validation would not require.
  const boolCellApplies = (cell: VtCellDef, ids: string[]): boolean => {
    if (!cell.dependsOnKey) return true;
    const parent = vt.cells.findIndex((p) => p.key === cell.dependsOnKey);
    return parent < 0 || isTrue(data[ids[parent]]);
  };

  // Stored as the string "true" / "false", as the row-by-row entry stores it;
  // "Sans réponse" stores nothing. Answering a gate anything but Yes clears
  // the answers that depended on it, so no answer outlives its question.
  const setBoolCell = (cell: VtCellDef, ids: string[], id: string, value: string) => {
    onChange(id, value === "" ? null : value);
    if (value === "true") return;
    vt.cells.forEach((other, k) => {
      if (other.dependsOnKey === cell.key && entered(data[ids[k]])) onChange(ids[k], null);
    });
  };

  const headers = valueCells.map((c) => {
    const h = splitHeader(c.label, locale);
    // "Total (calculé)" → "Total", as the fixed-row grids show it.
    return c.kind === "computed" ? { ...h, header: h.header.replace(/\s*\((computed|calculé)\)\s*$/i, "") } : h;
  });
  const grouped = headers.some((h) => h.group);
  const bands = headers.reduce<{ title: string; span: number }[]>((acc, h, i) => {
    if (!h.group) return acc;
    const last = acc[acc.length - 1];
    if (last && headers[i - 1]?.group === h.group) last.span += 1;
    else acc.push({ title: h.group, span: 1 });
    return acc;
  }, []);

  const specialtyHeader = localized(labelCell.label, locale) || (isEn ? "Specialty" : "Spécialité");
  const rowName = (slot: number) => {
    const text = data[matrix[slot][0]];
    return entered(text) ? String(text) : isEn ? `Row ${slot + 1}` : `Ligne ${slot + 1}`;
  };

  // A count cell's value, or null while blank.
  const countAt = (slot: number, j: number): number | null => {
    const raw = data[matrix[slot][j + 1]];
    if (!entered(raw)) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  // A calculated cell: the sum of the row's counts entered so far, blank
  // while none is (the rule the saved total follows, vtFixedRowGrid.ts).
  const rowTotal = (slot: number): number | null => {
    let sum = 0;
    let any = false;
    for (let j = 0; j < valueCells.length; j++) {
      if (!isCount(j)) continue;
      const n = countAt(slot, j);
      if (n === null) continue;
      sum += n;
      any = true;
    }
    return any ? sum : null;
  };

  // Column total over the shown rows; blank while any of them is blank.
  // The calculated column's is the sum of the count columns' totals, so the
  // footer never disagrees with itself.
  const columnTotal = (j: number): number | null => {
    if (!isCount(j) && !isComputed(j)) return null;
    if (isComputed(j)) {
      let sum = 0;
      for (let k = 0; k < valueCells.length; k++) {
        if (!isCount(k)) continue;
        const t = columnTotal(k);
        if (t === null) return null;
        sum += t;
      }
      return sum;
    }
    let sum = 0;
    for (const slot of shown) {
      const n = countAt(slot, j);
      if (n === null) return null;
      sum += n;
    }
    return shown.length > 0 ? sum : null;
  };

  // Every column takes the one width this table's headings call for (see
  // tableLayout.ts), a Yes/No dropdown at least BOOLEAN_COL_PX. Letting the
  // columns share the slack equally stretched a three-digit count across a
  // third of the screen.
  const sharedColWidth = tableDataColumnWidthPx(
    headers.map((h) => h.header),
    spanningHeadingsOf(headers.map((h) => h.group || undefined)),
  );
  const dataColWidths = valueCells.map((_, j) =>
    isBoolean(j) ? Math.max(BOOLEAN_COL_PX, sharedColWidth) : sharedColWidth,
  );
  const preferredTableWidth = tablePreferredWidthPx(
    dataColWidths,
    TABLE_LABEL_COL_PX,
    // The trailing Σ total column.
    TABLE_MAX_DATA_COL_PX,
  );

  const headCls = "px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]";
  const cellBorder = "border-r border-b border-[var(--cam-table-line)]";
  const capacity = matrix.length;
  // Same cell input as StatisticalGridRenderer, marked the same way when the
  // wizard is showing which cells a started row still owes.
  const inputCls =
    "w-full h-full min-h-[34px] px-2 py-1 bg-transparent border-0 outline-none rounded-none focus:ring-2 focus:ring-inset focus:ring-[var(--cam-table-focus)] focus:bg-transparent transition-colors";
  const missing = new Set(missingCells ?? []);
  const cellCls = (id: string) =>
    missing.has(id) ? `${inputCls} ring-2 ring-inset ring-[var(--cam-error)] bg-[rgba(179,38,30,0.06)]` : inputCls;

  return (
    <div>
      <div
        className="overflow-hidden border border-[var(--cam-table-frame)] rounded-[4px] bg-[var(--cam-surface)]"
        style={{ width: "100%", maxWidth: `min(100%, ${TABLE_MAX_WIDTH_PX}px)` }}
      >
        <div className="relative w-full overflow-x-auto">
          <DataTable
            ref={tableRef}
            className="border-collapse table-fixed"
            style={{ width: "100%", minWidth: preferredTableWidth }}
          >
            {vt.title && <caption className="sr-only">{localized(vt.title, locale)}</caption>}
            <colgroup>
              {/* The shared label width, so the label column lines up with
                  the fixed-row tables on the same screen. */}
              <col style={{ minWidth: TABLE_LABEL_COL_PX }} />
              {valueCells.map((c, j) => (
                <col key={c.key} style={{ width: dataColWidths[j] }} />
              ))}
              <col style={{ width: TABLE_MAX_DATA_COL_PX }} />
            </colgroup>
            <thead className="bg-[var(--cam-table-head-bg)] border-b-2 border-[var(--cam-table-strong)]">
              <tr>
                <CornerHeader rowSpan={grouped ? 2 : 1} className={`sticky left-0 z-20 px-3 ${headCls}`}>
                  {specialtyHeader}
                </CornerHeader>
                {grouped
                  ? (() => {
                      const out: ReactNode[] = [];
                      let band = 0;
                      for (let i = 0; i < headers.length; i++) {
                        if (headers[i].group) {
                          const b = bands[band++];
                          out.push(
                            <GroupHeader key={`band-${i}`} colSpan={b.span} className={headCls}>
                              {b.title}
                            </GroupHeader>,
                          );
                          i += b.span - 1;
                        } else {
                          out.push(
                            <LeafHeader key={valueCells[i].key} rowSpan={2} className={headCls}>
                              {headers[i].header}
                            </LeafHeader>,
                          );
                        }
                      }
                      return out;
                    })()
                  : headers.map((h, i) => (
                      <LeafHeader key={valueCells[i].key} className={headCls}>
                        {h.header}
                      </LeafHeader>
                    ))}
                <LeafHeader rowSpan={grouped ? 2 : 1} className={headCls}>
                  <span className="sr-only">Actions</span>
                </LeafHeader>
              </tr>
              {grouped && (
                <tr>
                  {headers.map((h, i) =>
                    h.group ? (
                      <LeafHeader key={valueCells[i].key} className={headCls}>
                        {h.header}
                      </LeafHeader>
                    ) : null,
                  )}
                </tr>
              )}
            </thead>
            <tbody>
              {shown.map((slot) => {
                const ids = matrix[slot];
                const name = rowName(slot);
                return (
                  <tr key={slot}>
                    <Cell className={`sticky left-0 z-10 p-0 bg-[var(--cam-surface)] ${cellBorder}`}>
                      <TextInput
                        id={`cell-input-${ids[0]}`}
                        type="text"
                        className={cellCls(ids[0])}
                        aria-invalid={missing.has(ids[0]) ? true : undefined}
                        value={entered(data[ids[0]]) ? String(data[ids[0]]) : ""}
                        // An empty white cell gave no cue that the name is
                        // typed here; the counts beside it need none.
                        placeholder={isEn ? "Type the name" : "Saisir le nom"}
                        aria-label={`${isEn ? `Row ${slot + 1}` : `Ligne ${slot + 1}`} - ${specialtyHeader}`}
                        onChange={(e) => onChange(ids[0], e.target.value === "" ? null : e.target.value)}
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim();
                          if (trimmed !== e.target.value) onChange(ids[0], trimmed === "" ? null : trimmed);
                        }}
                      />
                    </Cell>
                    {valueCells.map((c, j) => {
                      const id = ids[j + 1];
                      const raw = data[id];
                      if (isComputed(j)) {
                        return (
                          <Cell
                            key={c.key}
                            aria-label={`${name} - ${headers[j].header}`}
                            className={`px-2.5 py-2 bg-[var(--cam-table-readonly-bg)] ${cellBorder}`}
                          >
                            <CellValue value={rowTotal(slot)} computed />
                          </Cell>
                        );
                      }
                      if (isBoolean(j)) {
                        const cellName = `${name} - ${headers[j].header}`;
                        // Applies only while the answer it depends on is Yes
                        // (5.2's 2nd Yes/No question), the gate validation
                        // uses — shown as an inert cell rather than hidden,
                        // so the column keeps its shape.
                        if (!boolCellApplies(c, ids)) {
                          return (
                            <Cell
                              key={c.key}
                              aria-label={`${cellName} (${t("vtTableRenderer.booleanNotApplicable")})`}
                              className={`px-2.5 py-2 bg-[var(--cam-table-readonly-bg)] ${cellBorder}`}
                            >
                              <CellValue value={null} />
                            </Cell>
                          );
                        }
                        return (
                          <Cell key={c.key} className={`p-0 bg-[var(--cam-surface)] ${cellBorder}`}>
                            <SelectInput
                              id={`cell-input-${id}`}
                              className={cellCls(id) + (entered(raw) ? "" : " text-[var(--cam-text-muted)]")}
                              aria-invalid={missing.has(id) ? true : undefined}
                              aria-label={cellName}
                              value={entered(raw) ? (isTrue(raw) ? "true" : "false") : ""}
                              onChange={(e) => setBoolCell(c, ids, id, e.target.value)}
                            >
                              {/* Unanswered still reads as unanswered and still
                                  stores nothing (§9), but it is a prompt rather
                                  than a choice: disabled and hidden from the
                                  open list, as everywhere else in the wizard. */}
                              <option value="" disabled hidden>
                                {t("vtWizard.select")}
                              </option>
                              <option value="true">{t("vtTableRenderer.booleanYes")}</option>
                              <option value="false">{t("vtTableRenderer.booleanNo")}</option>
                            </SelectInput>
                          </Cell>
                        );
                      }
                      return (
                        <Cell key={c.key} className={`p-0 bg-[var(--cam-surface)] ${cellBorder}`}>
                          <NumberInput
                            id={`cell-input-${id}`}
                            type="number"
                            className={cellCls(id)}
                            aria-invalid={missing.has(id) ? true : undefined}
                            min={0}
                            inputMode="numeric"
                            value={entered(raw) ? String(raw) : ""}
                            aria-label={`${name} - ${headers[j].group ? `${headers[j].group} - ` : ""}${headers[j].header}`}
                            onWheel={(e) => e.currentTarget.blur()}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => onChange(id, e.target.value === "" ? null : Number(e.target.value))}
                          />
                        </Cell>
                      );
                    })}
                    <Cell className={`px-2 ${cellBorder}`}>
                      <button
                        type="button"
                        onClick={() => remove(slot)}
                        aria-label={isEn ? `Remove ${name}` : `Supprimer ${name}`}
                        className="cam-text-button is-danger"
                      >
                        {isEn ? "Remove" : "Supprimer"}
                      </button>
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
            {hasTotals && (
              <tfoot className="bg-[var(--cam-table-readonly-bg)] border-t-2 border-[var(--cam-table-strong)]">
                <tr>
                  <RowHeader total className="sticky left-0 z-20 bg-[var(--cam-table-readonly-bg)] px-3 py-2.5 border-r border-[var(--cam-table-frame)]">
                    Total
                  </RowHeader>
                  {valueCells.map((c, j) => (
                    <Cell
                      key={c.key}
                      aria-label={`Total - ${headers[j].group ? `${headers[j].group} - ` : ""}${headers[j].header}`}
                      className="px-2.5 py-2 border-r border-[var(--cam-table-line)]"
                    >
                      <CellValue value={columnTotal(j)} total />
                    </Cell>
                  ))}
                  <Cell />
                </tr>
              </tfoot>
            )}
          </DataTable>
        </div>
      </div>
      <div style={{ marginTop: "var(--cam-space-3)", display: "flex", alignItems: "center", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
        <button type="button" className="cam-text-button" onClick={add} disabled={next === null}>
          {isEn ? "Add a specialty" : "Ajouter une spécialité"}
        </button>
        <span style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
          {isEn ? `${shown.length} of ${capacity} rows at most` : `${shown.length} ligne(s) sur ${capacity} au maximum`}
        </span>
      </div>
    </div>
  );
}
