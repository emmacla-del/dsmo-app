// Tableau view for the VT fixed-row tables (4.2, 4.7–4.9, 4.11, 5.3, 5.4,
// 8.1–8.3, 8.6): every table whose rows are fixed in the schema
// (`vt.progressiveRows === false`, not a roster).
//
// Built entirely from the schema's own metadata — rows from `vt.rows`,
// columns from `vt.cells`, field keys from `table.matrix` — so the grid
// writes exactly the cells the guided entry (VtWizardFixedRowMultiNumberEntry)
// writes.
//
// Totals are saved (owner, 2026-10-11), in both modes, by one rule:
// vtFixedRowTotalsToSave() lists every stored total that differs from the sum
// of its own group, and useVtFixedRowTotals (lib/use-vt-fixed-row-totals.ts)
// writes those for the whole declaration after each change — which also
// fills in totals for rows entered before totals were saved. The
// grid's own row-sum is switched off (recalc below) because it adds the whole
// row into the first total, wrong for grouped tables such as 4.8.
//
// The server's log-only shadow validator checks saved totals by the same
// group rule (vtTotalSiblingKeys in onefop-shadow-validator.service.ts).

import type { FormData, LocalizedText, OnefopField, VtCellDef } from "@/lib/onefop-schema";
import type {
  FixedMatrixDefinition,
  HeaderGroupDefinition,
  StatisticalCellDefinition,
  StatisticalColumnDefinition,
} from "./StatisticalTableDefinition";

type VtCell = VtCellDef;

const GROUP_SEPARATOR = " — ";

/** True for the tables this grid serves. */
export function isVtFixedRowTable(field: OnefopField): boolean {
  const vt = field.table?.vt;
  return Boolean(vt && !vt.progressiveRows && !vt.isRoster && vt.rows.length > 0);
}

function cellFieldKey(field: OnefopField, rowIdx: number, cellIdx: number): string {
  const vt = field.table!.vt!;
  return field.table?.matrix?.[rowIdx]?.[cellIdx] ?? `${vt.rows[rowIdx].id}_${vt.cells[cellIdx].key}`;
}

/** "Incoming — Men" → group "Incoming", header "Men"; null when not grouped. */
function splitLabel(label: LocalizedText | null | undefined): { group: LocalizedText; header: LocalizedText } | null {
  if (!label?.fr || !label?.en) return null;
  const fr = label.fr.split(GROUP_SEPARATOR);
  const en = label.en.split(GROUP_SEPARATOR);
  if (fr.length !== 2 || en.length !== 2) return null;
  return { group: { fr: fr[0], en: en[0] }, header: { fr: fr[1], en: en[1] } };
}

function computedHeader(header: LocalizedText): LocalizedText {
  const clean = (text: string) => text.replace(/\s*\((computed|calculé)\)\s*$/i, "").replace(/^Σ\s*/, "");
  return { fr: `Σ ${clean(header.fr)}`, en: `Σ ${clean(header.en)}` };
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Number cells a computed cell adds up: those sharing its prefix ("entrant_" for "entrant_total"), else all. */
function computedSiblings(cells: VtCell[], computed: VtCell): VtCell[] {
  const prefix = computed.key.replace(/_?total$/i, "");
  const numbers = cells.filter((c) => c.kind === "number");
  if (!prefix) return numbers;
  const grouped = numbers.filter((c) => c.key.startsWith(`${prefix}_`));
  return grouped.length > 0 ? grouped : numbers;
}

export function buildVtFixedRowGridDefinition(field: OnefopField): FixedMatrixDefinition {
  const vt = field.table!.vt!;
  const split = vt.cells.map((c) => splitLabel(c.label));
  const grouped = split.every(Boolean);

  const columns: StatisticalColumnDefinition[] = vt.cells.map((cell, j) => {
    const parts = grouped ? split[j]! : null;
    const header = parts?.header ?? cell.label ?? { fr: cell.key, en: cell.key };
    const kind = cell.kind === "computed" ? "computed" : "number";
    return {
      key: cell.key,
      header: kind === "computed" ? computedHeader(header) : header,
      kind,
      align: "right",
      ...(parts ? { group: parts.group } : {}),
    };
  });

  const headerGroups: HeaderGroupDefinition[] | undefined = grouped
    ? columns.reduce<HeaderGroupDefinition[]>((acc, col) => {
        const last = acc[acc.length - 1];
        if (last && last.title.fr === col.group!.fr && last.title.en === col.group!.en) last.colSpan += 1;
        else acc.push({ title: col.group!, colSpan: 1 });
        return acc;
      }, [])
    : undefined;

  const rows = vt.rows.map((row, i) => ({
    id: row.id,
    label: row.label ?? { fr: row.id, en: row.id },
    cells: Object.fromEntries(
      vt.cells.map((cell, j): [string, StatisticalCellDefinition] => [
        cell.key,
        {
          key: cell.key,
          fieldKey: cellFieldKey(field, i, j),
          kind: cell.kind === "computed" ? "computed" : "number",
          min: 0,
          ...(cell.formula ? { formula: cell.formula } : {}),
        },
      ]),
    ),
  }));

  const noun = vt.progressNoun;
  return {
    id: field.id.toLowerCase(),
    paperCode: vt.paperCode ?? field.paperCode ?? field.id,
    title: field.label ?? vt.title ?? { fr: field.id, en: field.id },
    ...(vt.title ? { caption: vt.title } : {}),
    type: "fixed-matrix",
    rowHeaderLabel: noun ? { fr: capitalize(noun.fr), en: capitalize(noun.en) } : { fr: "", en: "" },
    ...(headerGroups ? { headerGroups } : {}),
    columns,
    rows,
    hasTotalRow: true,
    totalRowLabel: { fr: "Total", en: "Total" },
    // Totals are saved by vtFixedRowTotalsToSave (see the header comment); a
    // recalc that returns nothing stops the grid's own whole-row sum.
    recalc: () => ({}),
    calculationMode: "materialized",
  };
}

/** Every total cell of the table with the sum of its group, or null when the group is empty. */
function computedTotals(field: OnefopField, data: FormData): Record<string, number | null> {
  const vt = field.table?.vt;
  const totals: Record<string, number | null> = {};
  if (!vt) return totals;
  vt.rows.forEach((_, i) => {
    vt.cells.forEach((cell, j) => {
      if (cell.kind !== "computed") return;
      let sum = 0;
      let any = false;
      for (const sibling of computedSiblings(vt.cells, cell)) {
        const raw = data[cellFieldKey(field, i, vt.cells.indexOf(sibling))];
        if (raw === undefined || raw === null || raw === "") continue;
        const n = Number(raw);
        if (Number.isFinite(n)) {
          sum += n;
          any = true;
        }
      }
      totals[cellFieldKey(field, i, j)] = any ? sum : null;
    });
  });
  return totals;
}

/**
 * The data with each row's totals filled in, for the grid to show at once —
 * before vtFixedRowTotalsToSave's writes come back through the draft.
 */
export function withVtFixedRowTotals(field: OnefopField, data: FormData): FormData {
  const totals = computedTotals(field, data);
  return Object.keys(totals).length === 0 ? data : { ...data, ...totals };
}

/**
 * The total cells whose stored value differs from the sum of their group —
 * the writes that keep saved totals right. Empty when everything matches, so
 * applying them after every change settles at once.
 */
export function vtFixedRowTotalsToSave(field: OnefopField, data: FormData): Record<string, number | null> {
  const updates: Record<string, number | null> = {};
  for (const [key, total] of Object.entries(computedTotals(field, data))) {
    const raw = data[key];
    const stored = raw === undefined || raw === null || raw === "" ? null : Number(raw);
    if (stored !== total) updates[key] = total;
  }
  return updates;
}
