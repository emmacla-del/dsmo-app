/**
 * Entry aids for the dense statistical grids (StatisticalGridRenderer): the
 * arithmetic behind pasting a block copied from a spreadsheet, recopying the
 * cell above, putting 0 in the rows an establishment leaves empty, and
 * counting the blanks that remain.
 *
 * All of it is pure, so the rules are testable away from the DOM, and all of
 * it writes only through the cells the definition already declares — no
 * statistical variable, cell key or stored total is invented here.
 *
 * Two rules the whole module holds to:
 *
 * 1. A blank is not a zero (CLAUDE.md §9). Nothing here fills a blank on its
 *    own: every write comes from a respondent's paste, keystroke or explicit
 *    action, and the renderer keeps one step of undo over it.
 * 2. A calculated cell is never written. Totals are the business of the
 *    definition's `recalc` and, for the VT tables, of useVtFixedRowTotals —
 *    a pasted or filled total would fight them.
 */
import type { FormData } from "@/lib/onefop-schema";
import type {
  FixedMatrixDefinition,
  StatisticalCellDefinition,
  StatisticalRowDefinition,
} from "./StatisticalTableDefinition";

/** A typed value, including an explicit zero. Blank is not an answer. */
export function isEntered(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/** The rows the grid puts in its tbody — a stored total row goes to the foot. */
export function bodyRowsOf(definition: FixedMatrixDefinition): StatisticalRowDefinition[] {
  const hasStoredTotalRow = definition.rows.some((r) => r.isTotal);
  return hasStoredTotalRow ? definition.rows.filter((r) => !r.isTotal) : definition.rows;
}

/** A cell the respondent types a count into. */
function isTypedCount(
  cell: StatisticalCellDefinition | undefined,
): cell is StatisticalCellDefinition {
  return Boolean(cell && cell.kind === "number");
}

export type CountParse =
  | { ok: true; value: number | null }
  | { ok: false; reason: "notWhole" | "outOfRange" };

/**
 * One pasted or typed count. A spreadsheet pastes its own formatting, so the
 * digit groups it may have put in ("1 234", "1.234") are stripped before the
 * value is read; a decimal, a sign or anything else is refused rather than
 * rounded, since a count of people is a whole number (onefop-validation's
 * own rule).
 */
export function parseCount(raw: string, cell?: { min?: number; max?: number }): CountParse {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") return { ok: true, value: null };
  // Digit-group separators only: a dot before exactly three digits, and any
  // kind of space. "1.5" keeps its dot and is refused below, as it must be.
  const compact = trimmed.replace(/[\s  ]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "");
  if (!/^\d+$/.test(compact)) return { ok: false, reason: "notWhole" };
  const value = Number(compact);
  if (!Number.isSafeInteger(value)) return { ok: false, reason: "notWhole" };
  const min = cell?.min ?? 0;
  if (value < min) return { ok: false, reason: "outOfRange" };
  if (cell?.max !== undefined && value > cell.max) return { ok: false, reason: "outOfRange" };
  return { ok: true, value };
}

/**
 * A block copied from a spreadsheet, as rows of cells. Excel, LibreOffice and
 * Sheets all put tabs between cells and newlines between rows; a single value
 * comes back as one cell.
 */
export function parsePastedGrid(text: string): string[][] {
  const normalised = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (normalised === "") return [];
  return normalised.split("\n").map((line) => line.split("\t"));
}

export interface PastePlan {
  /** Cells to write, by field key. */
  updates: Record<string, number | null>;
  /** Pasted values that landed on a calculated cell, which keeps its own value. */
  computedSkipped: number;
  /** Pasted values refused: not a whole count, or outside the cell's range. */
  rejected: number;
  /** Pasted values that fell outside the table's rows or columns. */
  outside: number;
}

/**
 * The writes a paste makes, anchored at the focused cell and spreading right
 * and down — the spreadsheet convention, so a block copied from one lands
 * where it looks like it will.
 *
 * `rowIdx` and `colIdx` are the focused cell's position as the grid numbers
 * them: the row's index among `bodyRowsOf`, the column's among
 * `definition.columns`.
 */
export function planPaste(
  definition: FixedMatrixDefinition,
  rowIdx: number,
  colIdx: number,
  grid: string[][],
): PastePlan {
  const rows = bodyRowsOf(definition);
  const plan: PastePlan = { updates: {}, computedSkipped: 0, rejected: 0, outside: 0 };

  grid.forEach((line, dr) => {
    line.forEach((raw, dc) => {
      const row = rows[rowIdx + dr];
      const col = definition.columns[colIdx + dc];
      const cell = row && col ? row.cells[col.key] : undefined;
      if (!cell) {
        // An empty cell outside the table is not worth reporting: a
        // spreadsheet selection often carries a trailing one.
        if (raw.trim() !== "") plan.outside += 1;
        return;
      }
      if (!isTypedCount(cell)) {
        if (raw.trim() !== "") plan.computedSkipped += 1;
        return;
      }
      const parsed = parseCount(raw, cell);
      if (!parsed.ok) {
        plan.rejected += 1;
        return;
      }
      plan.updates[cell.fieldKey] = parsed.value;
    });
  });

  return plan;
}

/** Every blank cell the respondent can type into, row by row as they are read. */
export function blankCellKeys(definition: FixedMatrixDefinition, data: FormData): string[] {
  const blanks: string[] = [];
  for (const row of bodyRowsOf(definition)) {
    for (const col of definition.columns) {
      const cell = row.cells[col.key];
      if (!isTypedCount(cell)) continue;
      if (!isEntered(data[cell.fieldKey])) blanks.push(cell.fieldKey);
    }
  }
  return blanks;
}

/** Cells the respondent can type into, blank or not. */
export function typedCellCount(definition: FixedMatrixDefinition): number {
  let total = 0;
  for (const row of bodyRowsOf(definition)) {
    for (const col of definition.columns) {
      if (isTypedCount(row.cells[col.key])) total += 1;
    }
  }
  return total;
}

export interface ZeroPlan {
  updates: Record<string, number>;
  /** Rows that would be set to zero. */
  rows: number;
}

/**
 * Put 0 across the rows that carry no figure at all — the establishment with
 * no learners in a specialty, the centre with none of a category of staff.
 *
 * Only a wholly blank row is filled. A row holding one figure is left alone
 * on purpose: its remaining blanks are the respondent's to answer, and
 * zeroing them would both answer for them (§9) and risk contradicting a
 * total they have already typed, which the coherence checks of §7 compare
 * against the breakdown. The renderer keeps one step of undo over this.
 */
export function planZeroEmptyRows(definition: FixedMatrixDefinition, data: FormData): ZeroPlan {
  const plan: ZeroPlan = { updates: {}, rows: 0 };
  for (const row of bodyRowsOf(definition)) {
    const cells: StatisticalCellDefinition[] = [];
    let anyEntered = false;
    for (const col of definition.columns) {
      const cell = row.cells[col.key];
      if (!isTypedCount(cell)) continue;
      cells.push(cell);
      if (isEntered(data[cell.fieldKey])) anyEntered = true;
    }
    if (anyEntered || cells.length === 0) continue;
    for (const cell of cells) plan.updates[cell.fieldKey] = 0;
    plan.rows += 1;
  }
  return plan;
}

/**
 * Recopying the cell above into this one (Ctrl+D, as a spreadsheet does).
 * Null when there is no row above, when either cell is calculated, or when
 * the cell above is blank — a blank is not a value to copy.
 */
export function planCopyDown(
  definition: FixedMatrixDefinition,
  rowIdx: number,
  colIdx: number,
  data: FormData,
): Record<string, number> | null {
  if (rowIdx <= 0) return null;
  const rows = bodyRowsOf(definition);
  const col = definition.columns[colIdx];
  if (!col) return null;
  const target = rows[rowIdx]?.cells[col.key];
  const source = rows[rowIdx - 1]?.cells[col.key];
  if (!isTypedCount(target) || !isTypedCount(source)) return null;
  const raw = data[source.fieldKey];
  if (!isEntered(raw)) return null;
  const parsed = parseCount(String(raw), target);
  if (!parsed.ok || parsed.value === null) return null;
  return { [target.fieldKey]: parsed.value };
}

/** The values behind a set of writes, so one step of undo can restore them. */
export function snapshotOf(keys: string[], data: FormData): Record<string, unknown> {
  const before: Record<string, unknown> = {};
  for (const key of keys) before[key] = isEntered(data[key]) ? data[key] : null;
  return before;
}
