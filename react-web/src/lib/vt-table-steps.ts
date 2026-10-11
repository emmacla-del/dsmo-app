// One table per screen in VT Sections 4 and 8 (docs/plans/vt-table-progression.md).
//
// A step is one group of the section screen (vtWizardGroupFields): one table,
// or 8.5's six fields. This module only answers questions about steps — which
// apply, which owns an issue, which comes next — so the shell and the section
// screen agree on them. No UI here.
//
// Rules (owner decisions, 2026-10-11):
// - D3: a step whose tables the preliminary questionnaire switched off
//   ("NONE") is skipped by Next and Previous, and not counted in "Table n of m".
// - An issue belongs to the step whose field owns it (fieldOwnsIssue). The
//   cross-table checks put their issue on the checked table (vt-cross-table.ts),
//   so they show on the later table of each pair. An issue no step owns goes to
//   the last applicable step, so Next can never leave the section past it.

import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { isVtCentreClosed, vtTableStatus } from "@/lib/vt-quiz";
import { fieldOwnsIssue } from "@/lib/wizard-navigation";

/** The VT sections shown one table per screen (D2). */
export const VT_STEPPED_SECTION_IDS: ReadonlySet<string> = new Set([
  "section4_vocationalTraining",
  "section8_vocationalTraining",
]);

export interface VtStep {
  fields: readonly OnefopField[];
}

/** False only when every field of the step is a table the questionnaire switched off. */
export function isVtStepApplicable(step: VtStep, data: FormData): boolean {
  if (step.fields.length === 0) return false;
  if (isVtCentreClosed(data)) return true;
  return !step.fields.every((f) => Boolean(f.table) && vtTableStatus(f.id, data) === "NONE");
}

/** Indexes of the applicable steps, in order. */
export function vtApplicableSteps(steps: readonly VtStep[], data: FormData): number[] {
  return steps.flatMap((s, i) => (isVtStepApplicable(s, data) ? [i] : []));
}

/** The next applicable step after `from`, or null after the last. */
export function vtNextStep(steps: readonly VtStep[], from: number, data: FormData): number | null {
  return vtApplicableSteps(steps, data).find((i) => i > from) ?? null;
}

/** The previous applicable step before `from`, or null before the first. */
export function vtPreviousStep(steps: readonly VtStep[], from: number, data: FormData): number | null {
  const before = vtApplicableSteps(steps, data).filter((i) => i < from);
  return before.length > 0 ? before[before.length - 1] : null;
}

/** The first applicable step (0 when none applies, so the screen still has one). */
export function vtFirstStep(steps: readonly VtStep[], data: FormData): number {
  return vtApplicableSteps(steps, data)[0] ?? 0;
}

/** The last applicable step — where Previous lands when coming back from the next section. */
export function vtLastStep(steps: readonly VtStep[], data: FormData): number {
  const applicable = vtApplicableSteps(steps, data);
  return applicable.length > 0 ? applicable[applicable.length - 1] : Math.max(0, steps.length - 1);
}

/** The step whose field owns the issue, or -1 when none does. */
export function vtStepOwningIssue(steps: readonly VtStep[], issueFieldId: string): number {
  return steps.findIndex((s) => s.fields.some((f) => fieldOwnsIssue(f, issueFieldId)));
}

/** The step an issue is shown on: its owner, else the last applicable step. */
export function vtStepForIssue(steps: readonly VtStep[], issueFieldId: string, data: FormData): number {
  const owner = vtStepOwningIssue(steps, issueFieldId);
  return owner >= 0 ? owner : vtLastStep(steps, data);
}

/** The issues Next checks on step `index`. */
export function vtStepIssues<I extends { fieldId: string }>(
  steps: readonly VtStep[],
  index: number,
  issues: readonly I[],
  data: FormData,
): I[] {
  return issues.filter((issue) => vtStepForIssue(steps, issue.fieldId, data) === index);
}

/** "Table n of m" among the applicable steps; null for a step that does not apply. */
export function vtStepPosition(
  steps: readonly VtStep[],
  index: number,
  data: FormData,
): { number: number; total: number } | null {
  const applicable = vtApplicableSteps(steps, data);
  const at = applicable.indexOf(index);
  return at < 0 ? null : { number: at + 1, total: applicable.length };
}
