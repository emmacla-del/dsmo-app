import type { FormData } from "@/lib/onefop-schema";
import type {
  FixedMatrixDefinition,
  StatisticalCellDefinition,
  StatisticalRowDefinition,
} from "./StatisticalTableDefinition";

/** A typed value, including an explicit zero. Blank is not an answer. */
export function isEnteredValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

export function quizGovernsEntry(data?: FormData): boolean {
  return Boolean(data?._scopeConfig && typeof data._scopeConfig === "object");
}

function isEnterable(cell: StatisticalCellDefinition): boolean {
  return cell.kind === "number" || cell.kind === "text" || cell.kind === "select";
}

function rowNumberIsPositive(row: StatisticalRowDefinition, data: FormData): boolean {
  for (const cell of Object.values(row.cells)) {
    if (cell.kind !== "number") continue;
    const raw = data[cell.fieldKey];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isNaN(n) && n > 0) return true;
  }
  return false;
}

function rowsForDefinition(definition: FixedMatrixDefinition): StatisticalRowDefinition[] {
  if (definition.cspSlices?.length && definition.buildRowsForCsp) {
    return definition.cspSlices.flatMap((csp) => definition.buildRowsForCsp!(csp));
  }
  return definition.rows;
}

/**
 * Cells the preliminary quiz left on this table. The definition is already
 * narrowed to the categories and age bands the respondent kept. Computed
 * totals are not entered. A free-text label is required only once its row
 * has a count above zero (a zero line does not need a name).
 */
export function missingQuizFieldKeys(definition: FixedMatrixDefinition, data: FormData): string[] {
  const missing: string[] = [];
  const seen = new Set<string>();

  const isReasonsOrSkillsOrTraining =
    definition.id.toLowerCase().includes("s3q02") ||
    definition.id.toLowerCase().includes("s4q02") ||
    definition.id.toLowerCase().includes("s4q03");

  const rows = rowsForDefinition(definition);
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (row.isTotal || row.isSubtotal) continue;

    const textKey = row.labelText?.fieldKey;
    const hasText = Boolean(textKey && String(data[textKey] ?? "").trim().length > 0);
    const hasAnyCell = Object.values(row.cells).some(
      (c) => isEnterable(c) && isEnteredValue(data[c.fieldKey])
    );
    // For reasons/skills/training: Row 1 is required once the table is reported.
    // Subsequent rows are required if the user started entering text or numbers for that row.
    const rowIsActive = !isReasonsOrSkillsOrTraining || rIdx === 0 || hasText || hasAnyCell;

    if (rowIsActive) {
      for (const cell of Object.values(row.cells)) {
        if (!isEnterable(cell) || seen.has(cell.fieldKey)) continue;
        seen.add(cell.fieldKey);
        if (!isEnteredValue(data[cell.fieldKey])) missing.push(cell.fieldKey);
      }
      if (textKey && !seen.has(textKey)) {
        if (!hasText) {
          seen.add(textKey);
          missing.push(textKey);
        }
      }
    }
  }
  return missing;
}

/** Mark the entry cells required so both modes can show the asterisk. */
export function applyQuizRequired(
  definition: FixedMatrixDefinition,
  data?: FormData,
): FixedMatrixDefinition {
  const mark = (rows: StatisticalRowDefinition[]): StatisticalRowDefinition[] =>
    rows.map((row) => {
      if (row.isTotal || row.isSubtotal) return row;
      const cells: Record<string, StatisticalCellDefinition> = {};
      for (const [key, cell] of Object.entries(row.cells)) {
        cells[key] = isEnterable(cell) ? { ...cell, required: true } : cell;
      }
      return { ...row, cells };
    });
  return {
    ...definition,
    rows: mark(definition.rows),
    buildRowsForCsp: definition.buildRowsForCsp
      ? (csp) => mark(definition.buildRowsForCsp!(csp))
      : undefined,
  };
}
