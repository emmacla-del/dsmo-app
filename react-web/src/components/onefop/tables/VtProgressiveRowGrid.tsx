"use client";

// Tableau view for the VT tables whose rows the respondent adds: a specialty
// typed in the first column, then counts (4.3–4.6, 8.4, 8.7). The schema
// gives each table fixed row slots (s4q3_row1_… to s4q3_row12_…); this grid
// writes exactly the cells the row-by-row entry
// (VtWizardProgressiveGuidedTableEntry) writes, so the two modes share data.
//
// A slot is shown once any of its cells is filled — the rule
// missingVtTableCells uses to decide which rows must be complete — so a row
// typed in either mode is never hidden in the other. "Add a specialty" shows
// the next free slot; "Remove" clears every cell of its slot (the slot is
// then free again, as in the row-by-row entry). Unanswered stays unanswered:
// clearing a number stores nothing, never 0.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import type { FormData, LocalizedText, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { TABLE_MAX_WIDTH_PX, tableMinWidthPx } from "./tableLayout";
import {
  Cell,
  CellValue,
  CornerHeader,
  DataTable,
  GroupHeader,
  LeafHeader,
  NumberInput,
  RowHeader,
  TextInput,
} from "../table/DataTable";

const GROUP_SEPARATOR = " — ";

/** Paper abbreviations used as group names, spelled out for respondents. */
const GROUP_NAMES: Record<string, LocalizedText> = {
  FI: { fr: "Formation initiale", en: "Initial training" },
  IT: { fr: "Formation initiale", en: "Initial training" },
  FC: { fr: "Formation continue", en: "Continuing training" },
  CT: { fr: "Formation continue", en: "Continuing training" },
};

/** True for the add-a-row tables made of one text cell then number cells only. */
export function isVtProgressiveNumberTable(field: OnefopField): boolean {
  const vt = field.table?.vt;
  if (!vt || !vt.progressiveRows || vt.isRoster || !field.table?.matrix?.length) return false;
  const [first, ...rest] = vt.cells;
  return first?.kind === "text" && rest.length > 0 && rest.every((c) => c.kind === "number");
}

const entered = (v: unknown) => v !== undefined && v !== null && v !== "";

/** Slots with at least one cell filled, in slot order. */
export function vtStartedSlots(field: OnefopField, data: FormData): number[] {
  const matrix = field.table?.matrix ?? [];
  return matrix.flatMap((ids, i) => (ids.some((id) => entered(data[id])) ? [i] : []));
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

function splitHeader(label: LocalizedText | null | undefined, locale: "fr" | "en") {
  const text = label ? localized(label, locale) : "";
  const parts = text.split(GROUP_SEPARATOR);
  if (parts.length !== 2) return { group: null, header: text };
  const name = GROUP_NAMES[parts[0].trim()];
  return { group: name ? localized(name, locale) : parts[0], header: parts[1] };
}

export function VtProgressiveRowGrid({
  field,
  data,
  onChange,
}: {
  field: OnefopField;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
}) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const isEn = locale === "en";
  const vt = field.table!.vt!;
  const matrix = field.table!.matrix!;
  const [labelCell, ...numberCells] = vt.cells;

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
    setOpened((o) => [...o, next]);
  };

  const remove = (slot: number) => {
    for (const id of matrix[slot]) if (entered(data[id])) onChange(id, null);
    setOpened((o) => o.filter((s) => s !== slot));
  };

  const headers = numberCells.map((c) => splitHeader(c.label, locale));
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

  // Column total over the shown rows; blank while any of them is blank.
  const columnTotal = (c: number): number | null => {
    let sum = 0;
    for (const slot of shown) {
      const raw = data[matrix[slot][c + 1]];
      if (!entered(raw)) return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      sum += n;
    }
    return shown.length > 0 ? sum : null;
  };

  const headCls = "px-2.5 py-2 border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]";
  const cellBorder = "border-r border-b border-[var(--cam-table-line)]";
  const capacity = matrix.length;
  // Same cell input as StatisticalGridRenderer.
  const inputCls =
    "w-full h-full min-h-[34px] px-2 py-1 bg-transparent border-0 outline-none rounded-none focus:ring-2 focus:ring-inset focus:ring-[var(--cam-table-focus)] focus:bg-transparent transition-colors";

  return (
    <div>
      <div
        className="w-full overflow-hidden border border-[var(--cam-table-frame)] rounded-[4px] bg-[var(--cam-surface)]"
        style={{ maxWidth: TABLE_MAX_WIDTH_PX }}
      >
        <div className="w-full overflow-x-auto">
          <DataTable
            ref={tableRef}
            className="w-full border-collapse table-fixed"
            style={{ minWidth: tableMinWidthPx(numberCells.length + 1, 200) }}
          >
            {vt.title && <caption className="sr-only">{localized(vt.title, locale)}</caption>}
            <colgroup>
              <col style={{ width: 200 }} />
              {numberCells.map((c) => (
                <col key={c.key} />
              ))}
              <col style={{ width: 96 }} />
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
                            <LeafHeader key={numberCells[i].key} rowSpan={2} className={headCls}>
                              {headers[i].header}
                            </LeafHeader>,
                          );
                        }
                      }
                      return out;
                    })()
                  : headers.map((h, i) => (
                      <LeafHeader key={numberCells[i].key} className={headCls}>
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
                      <LeafHeader key={numberCells[i].key} className={headCls}>
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
                        className={inputCls}
                        value={entered(data[ids[0]]) ? String(data[ids[0]]) : ""}
                        aria-label={`${isEn ? `Row ${slot + 1}` : `Ligne ${slot + 1}`} - ${specialtyHeader}`}
                        onChange={(e) => onChange(ids[0], e.target.value === "" ? null : e.target.value)}
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim();
                          if (trimmed !== e.target.value) onChange(ids[0], trimmed === "" ? null : trimmed);
                        }}
                      />
                    </Cell>
                    {numberCells.map((c, j) => {
                      const id = ids[j + 1];
                      const raw = data[id];
                      return (
                        <Cell key={c.key} className={`p-0 bg-[var(--cam-surface)] ${cellBorder}`}>
                          <NumberInput
                            id={`cell-input-${id}`}
                            type="number"
                            className={inputCls}
                            min={0}
                            inputMode="numeric"
                            placeholder="—"
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
            <tfoot className="bg-[var(--cam-table-readonly-bg)] border-t-2 border-[var(--cam-table-strong)]">
              <tr>
                <RowHeader total className="sticky left-0 z-20 bg-[var(--cam-table-readonly-bg)] px-3 py-2.5 border-r border-[var(--cam-table-frame)]">
                  Total
                </RowHeader>
                {numberCells.map((c, j) => (
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
