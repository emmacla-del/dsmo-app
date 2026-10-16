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

/**
 * 8.5 Trainers by professional status: six plain number fields in the schema
 * (status × sex) that the wizard draws as one table (Vt85StatusTable). They
 * count as that one table, never as six questions (defect 14 of the
 * 2026-10-16 VT run: Section 8 read "6 / 6 questions · 7 / 7 tables").
 */
export const VT85_FIELD_IDS = [
  "VT8_5_VP_M",
  "VT8_5_VP_F",
  "VT8_5_VNP_M",
  "VT8_5_VNP_F",
  "VT8_5_PERM_M",
  "VT8_5_PERM_F",
] as const;

const VT85_IDS = new Set<string>(VT85_FIELD_IDS);

export function isVt85Field(fieldId: string): boolean {
  return VT85_IDS.has(fieldId);
}

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
  // 8.5 is no schema table: it counts once, where its first field sits.
  const hasVt85 = section.fields.some((f) => f.id === VT85_FIELD_IDS[0] && isFieldVisible(f, data));
  const vt85Complete =
    hasVt85 && hasFigure([[...VT85_FIELD_IDS]], data) && !issues.some((issue) => VT85_IDS.has(issue.fieldId));
  return {
    complete: complete + (vt85Complete ? 1 : 0),
    total: tables.length + (hasVt85 ? 1 : 0),
  };
}
