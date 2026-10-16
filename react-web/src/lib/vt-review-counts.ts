// The tables of a VT section, as the review screen counts them ("8 / 11
// tables"). The question count (vtWizardSectionStats) leaves tables out, so
// Section 4, made only of tables, read "0 / 0 fields" (defect 3 of the
// 2026-10-15 VT run).
//
// A table counts when it is shown (its gateway is open) and the preliminary
// questionnaire did not switch it off. It is complete when it holds a figure
// and the validator reports nothing on it: the same issues that block Next
// on that table (fieldOwnsIssue, as the table steps use).
import type { FormData, OnefopSection } from "./onefop-schema";
import { isFieldVisible, isVtSectionWaived } from "./onefop-schema";
import { vtTableStatus } from "./vt-quiz";
import { fieldOwnsIssue } from "./wizard-navigation";

export interface VtTableCounts {
  complete: number;
  total: number;
}

function hasFigure(cellIds: string[][], data: FormData): boolean {
  return cellIds.some((row) => row.some((id) => data[id] !== undefined && data[id] !== null && data[id] !== ""));
}

export function vtSectionTableCounts(
  section: OnefopSection,
  data: FormData,
  issues: readonly { fieldId: string }[],
): VtTableCounts {
  if (isVtSectionWaived(section.id, data)) return { complete: 0, total: 0 };
  const tables = section.fields.filter(
    (f) => f.table?.matrix && isFieldVisible(f, data) && vtTableStatus(f.id, data) !== "NONE",
  );
  const complete = tables.filter(
    (f) => hasFigure(f.table!.matrix!, data) && !issues.some((issue) => fieldOwnsIssue(f, issue.fieldId)),
  ).length;
  return { complete, total: tables.length };
}
