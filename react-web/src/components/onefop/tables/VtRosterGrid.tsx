"use client";

// 8.8 as the paper prints it: one row per member of staff, one column per
// answer (name, first name, sex, status, administrative staff, academic and
// vocational diploma). The Grid half of 8.8's Grid / Guided switch; Guided is
// NominalRosterRenderer. Both write the same cells (definition.slots[].
// cellKeys) with the same values, so switching never loses an answer and
// validation, the PDF and the exports read one thing.

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type { FormData } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { TABLE_MAX_WIDTH_PX } from "./tableLayout";
import {
  type NominalRosterDefinition,
  type RosterFieldDefinition,
  type RosterRowSlot,
  clearRosterSlotData,
} from "./StatisticalTableDefinition";
import { Cell, CornerHeader, DataTable, GroupHeader, LeafHeader, SelectInput, TextInput } from "../table/DataTable";

const entered = (v: unknown) => v !== undefined && v !== null && v !== "";

/**
 * Column widths. These are the narrowest the eight answers of a row may get
 * (they add up to just under the frame on a small laptop); above that the
 * table fills its frame and the extra width is shared out in these same
 * proportions, so a wide screen gives the diplomas the most room. A chosen
 * answer may be clipped at the narrow end — the list still opens at its own
 * width — and the frame scrolls only below ~700px.
 */
const COLUMN_PX: Record<RosterFieldDefinition["kind"], number> = {
  text: 88,
  radio: 72,
  select: 92,
  boolean: 70,
  number: 72,
};
const NUMBER_COL_PX = 32;
const ACTIONS_COL_PX = 78;

/** A slot with any answer in it. */
function slotStarted(definition: NominalRosterDefinition, slot: RosterRowSlot, data: FormData): boolean {
  return definition.fields.some((f) => entered(data[slot.cellKeys[f.key]]));
}

export function VtRosterGrid({
  definition,
  data,
  onChange,
  missingCells,
}: {
  definition: NominalRosterDefinition;
  data: FormData;
  onChange: (cellId: string, value: unknown) => void;
  /** Cells to mark, once a blocked Next is showing the table's problems. */
  missingCells?: string[];
}) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const isEn = locale === "en";
  const missing = new Set(missingCells ?? []);

  // Rows opened with "Add" but not typed in yet (stored nowhere).
  const [opened, setOpened] = useState<number[]>([]);
  const focusSlot = useRef<number | null>(null);

  const startedIdx = definition.slots
    .map((s, i) => (slotStarted(definition, s, data) ? i : -1))
    .filter((i) => i >= 0);
  const shownSet = new Set([...startedIdx, ...opened]);
  // An empty table offers its first line straight away, like the paper.
  if (shownSet.size === 0) shownSet.add(0);
  const shown = [...shownSet].sort((a, b) => a - b);
  const nextFree = definition.slots.findIndex((_, i) => !shownSet.has(i));

  const firstKey = definition.fields[0]?.key;
  useEffect(() => {
    if (focusSlot.current === null || !firstKey) return;
    document.getElementById(`cell-input-${definition.slots[focusSlot.current].cellKeys[firstKey]}`)?.focus();
    focusSlot.current = null;
  });

  const add = () => {
    if (nextFree < 0) return;
    focusSlot.current = nextFree;
    // Every row on screen stays open, the empty first line included: it is
    // shown without being opened, and would vanish once another row is.
    setOpened((o) => [...new Set([...o, ...shown, nextFree])]);
  };

  const remove = (index: number) => {
    const slot = definition.slots[index];
    for (const [cellKey, value] of Object.entries(clearRosterSlotData(definition, slot))) {
      if (entered(data[cellKey])) onChange(cellKey, value);
    }
    setOpened((o) => o.filter((i) => i !== index));
  };

  const rowName = (slot: RosterRowSlot, index: number) => {
    const pk = data[slot.cellKeys[definition.primaryKeyField]];
    return entered(pk) ? String(pk) : isEn ? `Row ${index + 1}` : `Ligne ${index + 1}`;
  };

  // The columns already declare their own widths, so this is the width the
  // table takes, not a floor: until 2026-10-11 the table was also `w-full`,
  // and `table-fixed` shared the leftover width out over the columns anyway.
  const tableWidth =
    NUMBER_COL_PX + ACTIONS_COL_PX + definition.fields.reduce((sum, f) => sum + (COLUMN_PX[f.kind] ?? 140), 0);
  const cellBorder = "border-r border-b border-[var(--cam-table-line)]";
  // break-words: on a small screen "Administrative"/"administratif" is wider
  // than its column, and without it the heading ran over its neighbour.
  const headCls =
    "px-2.5 py-2 break-words hyphens-auto border-r border-b border-[var(--cam-table-frame)] text-[var(--cam-table-text)] bg-[var(--cam-table-head-bg)]";
  // An empty cell shows this rather than an answer; it is a prompt, not a
  // choice, so it is disabled and hidden from the open list (the pattern
  // FieldControl already uses). Choosing an answer is therefore final until
  // the row is removed.
  const hint = isEn ? "Select…" : "Sélectionner…";
  const hintCls = (value: unknown) => (entered(value) ? "" : " text-[var(--cam-text-muted)]");
  // One cell input for every grid (globals.css); a cell still owed is marked
  // from its aria-invalid, so the colour and the screen reader agree.
  const inputCls = "cam-cell-input";

  // The bands the paper prints over the columns (8.8: "Si formateur" over
  // the two qualifications, field.group). Consecutive fields that share one
  // are headed once, spanning them, and keep their own heading on a second
  // row; every other column heads both rows at once.
  const bands: { group: string | null; fields: RosterFieldDefinition[] }[] = [];
  for (const f of definition.fields) {
    const group = f.group ? localized(f.group, locale) : null;
    const open = bands[bands.length - 1];
    if (open && group !== null && open.group === group) open.fields.push(f);
    else bands.push({ group, fields: [f] });
  }
  const banded = bands.some((b) => b.group !== null);
  const spanRows = banded ? 2 : undefined;
  const leafHeader = (f: RosterFieldDefinition, rowSpan?: number) => (
    <LeafHeader key={f.key} rowSpan={rowSpan} className={headCls}>
      {localized(f.label, locale)}
      {/* Optional answers say so, as everywhere else. */}
      {f.kind === "text" && !f.required && (
        <span className="cam-roster-optional"> {isEn ? "(optional)" : "(facultatif)"}</span>
      )}
    </LeafHeader>
  );

  return (
    <div>
      {/* The table fills its frame and scrolls inside it, never the page,
          on a screen too narrow for eight answers. The frame is "relative"
          so the screen-reader caption (absolute) stays inside it; without
          that it widened the whole page. */}
      <div
        className="overflow-hidden border border-[var(--cam-table-frame)] rounded-[4px] bg-[var(--cam-surface)]"
        style={{ width: "100%", maxWidth: `min(100%, ${TABLE_MAX_WIDTH_PX}px)` }}
      >
        <div className="relative w-full overflow-x-auto">
          <DataTable className="border-collapse table-fixed" style={{ width: "100%", minWidth: tableWidth }}>
            <caption className="sr-only">{localized(definition.title, locale)}</caption>
            <colgroup>
              <col style={{ width: NUMBER_COL_PX }} />
              {definition.fields.map((f) => (
                <col key={f.key} style={{ width: COLUMN_PX[f.kind] ?? 140 }} />
              ))}
              <col style={{ width: ACTIONS_COL_PX }} />
            </colgroup>
            <thead className="bg-[var(--cam-table-head-bg)] border-b-2 border-[var(--cam-table-strong)]">
              <tr>
                <CornerHeader rowSpan={spanRows} className={`${headCls} whitespace-nowrap`}>
                  {isEn ? "No." : "N°"}
                </CornerHeader>
                {bands.map((band) =>
                  band.group === null ? (
                    band.fields.map((f) => leafHeader(f, spanRows))
                  ) : (
                    <GroupHeader key={band.group} colSpan={band.fields.length} className={headCls}>
                      {band.group}
                    </GroupHeader>
                  ),
                )}
                <LeafHeader rowSpan={spanRows} className={headCls}>
                  <span className="sr-only">Actions</span>
                </LeafHeader>
              </tr>
              {/* The banded columns' own headings, under their band. */}
              {banded && (
                <tr>
                  {bands.flatMap((band) => (band.group === null ? [] : band.fields.map((f) => leafHeader(f))))}
                </tr>
              )}
            </thead>
            <tbody>
              {shown.map((index) => {
                const slot = definition.slots[index];
                const name = rowName(slot, index);
                return (
                  <tr key={slot.rowId} data-slot-id={slot.rowId}>
                    <Cell className={`px-2 text-[var(--cam-text-muted)] ${cellBorder}`}>{index + 1}</Cell>
                    {definition.fields.map((f) => {
                      const id = slot.cellKeys[f.key];
                      const raw = data[id];
                      const label = `${name} - ${localized(f.label, locale)}`;
                      if (f.kind === "text") {
                        return (
                          <Cell key={f.key} className={`p-0 bg-[var(--cam-surface)] ${cellBorder}`}>
                            <TextInput
                              id={`cell-input-${id}`}
                              type="text"
                              className={inputCls}
                              aria-invalid={missing.has(id) ? true : undefined}
                              aria-label={label}
                              placeholder={localized(f.placeholder ?? null, locale)}
                              value={entered(raw) ? String(raw) : ""}
                              onChange={(e) => onChange(id, e.target.value === "" ? null : e.target.value)}
                              onBlur={(e) => {
                                const trimmed = e.target.value.trim();
                                if (trimmed !== e.target.value) onChange(id, trimmed === "" ? null : trimmed);
                              }}
                            />
                          </Cell>
                        );
                      }
                      if (f.kind === "boolean") {
                        // Stored as true / false, as the guided form stores it;
                        // unanswered stays a choice of its own (§9).
                        const value = raw === true || raw === "true" ? "true" : raw === false || raw === "false" ? "false" : "";
                        return (
                          <Cell key={f.key} className={`p-0 bg-[var(--cam-surface)] ${cellBorder}`}>
                            <SelectInput
                              id={`cell-input-${id}`}
                              className={inputCls + hintCls(value)}
                              aria-invalid={missing.has(id) ? true : undefined}
                              aria-label={label}
                              value={value}
                              onChange={(e) => onChange(id, e.target.value === "" ? null : e.target.value === "true")}
                            >
                              <option value="" disabled hidden>
                                {hint}
                              </option>
                              <option value="true">{isEn ? "Yes" : "Oui"}</option>
                              <option value="false">{isEn ? "No" : "Non"}</option>
                            </SelectInput>
                          </Cell>
                        );
                      }
                      // Coded answers (sex, status, diplomas): the label, as
                      // in the guided form; the stored value is the code key.
                      return (
                        <Cell key={f.key} className={`p-0 bg-[var(--cam-surface)] ${cellBorder}`}>
                          <SelectInput
                            id={`cell-input-${id}`}
                            className={inputCls + hintCls(raw)}
                            aria-invalid={missing.has(id) ? true : undefined}
                            aria-label={label}
                            value={entered(raw) ? String(raw) : ""}
                            onChange={(e) => onChange(id, e.target.value === "" ? null : e.target.value)}
                          >
                            <option value="" disabled hidden>
                              {hint}
                            </option>
                            {f.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {localized(opt.label, locale)}
                              </option>
                            ))}
                          </SelectInput>
                        </Cell>
                      );
                    })}
                    <Cell className={`px-2 ${cellBorder}`}>
                      <button
                        type="button"
                        onClick={() => remove(index)}
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
          </DataTable>
        </div>
      </div>

      <div className="cam-roster-grid-foot">
        <button type="button" className="cam-text-button" onClick={add} disabled={nextFree < 0}>
          {isEn ? "Add a row" : "Ajouter une ligne"}
        </button>
        <span className="cam-hint">
          {isEn
            ? `${shown.length} of ${definition.rosterCapacity} rows at most`
            : `${shown.length} sur ${definition.rosterCapacity} lignes au plus`}
        </span>
      </div>
    </div>
  );
}
