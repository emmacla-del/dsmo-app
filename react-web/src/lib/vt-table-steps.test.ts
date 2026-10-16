import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import type { FormData, OnefopSection } from "@/lib/onefop-schema";
import { validateSectionData } from "@/lib/onefop-validation";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import {
  VT_STEPPED_SECTION_IDS,
  isVtStepApplicable,
  vtFirstStep,
  vtLastStep,
  vtNextStep,
  vtPreviousStep,
  vtStepForIssue,
  vtStepIssues,
  vtStepOwningIssue,
  vtStepPosition,
  type VtStep,
} from "./vt-table-steps";

const sections = schemaEntity("vocationalTraining").sections;
const section = (id: string): OnefopSection => sections.find((s) => s.id === id)!;

/** One step per paper table ("8.5" for its six fields), as the section screen groups them. */
function stepsOf(s: OnefopSection): VtStep[] {
  const byCode = new Map<string, OnefopSection["fields"][number][]>();
  for (const f of s.fields) {
    const code = f.paperCode ?? f.id;
    byCode.set(code, [...(byCode.get(code) ?? []), f]);
  }
  return [...byCode.values()].map((fields) => ({ fields }));
}

const s4 = section("section4_vocationalTraining");
const s8 = section("section8_vocationalTraining");
const steps4 = stepsOf(s4);
const steps8 = stepsOf(s8);
const code = (steps: VtStep[], i: number | null) => (i === null ? null : steps[i].fields[0].paperCode);
const indexOf = (steps: VtStep[], paperCode: string) => steps.findIndex((s) => s.fields[0].paperCode === paperCode);

/** Every quiz answer set to `answer`; 2.18 offers initial training (4.6 applies) unless told otherwise. */
function quiz(answer: boolean, overrides: Record<string, boolean> = {}, initialTraining = true): FormData {
  const answers: Record<string, boolean> = {};
  for (const q of VT_QUIZ_QUESTIONS) answers[q.id] = answer;
  return {
    _scopeConfig: { vocationalTraining: { ...answers, ...overrides } },
    VT2_18: initialTraining ? ["Formation Initiale (FI)"] : ["Formation Continue (FC)"],
  };
}

test("Sections 4 and 8 are the stepped sections, with one step per table", () => {
  assert.deepEqual([...VT_STEPPED_SECTION_IDS].sort(), ["section4_vocationalTraining", "section8_vocationalTraining"]);
  assert.deepEqual(steps4.map((s) => s.fields[0].paperCode), ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11"]);
  assert.equal(steps8[indexOf(steps8, "8.5")].fields.length, 6);
});

test("with every table switched on, Next walks 4.1 → 4.11 and stops", () => {
  const data = quiz(true);
  const visited: (string | undefined | null)[] = [];
  for (let i: number | null = vtFirstStep(steps4, data); i !== null; i = vtNextStep(steps4, i, data)) {
    visited.push(code(steps4, i));
  }
  assert.equal(visited.length, 11);
  assert.equal(visited.at(-1), "4.11");
});

test("tables switched off in the questionnaire are skipped by Next and Previous (D3)", () => {
  const data = quiz(true, { unemployedQualified: false, informalSector: false });
  assert.equal(code(steps4, vtNextStep(steps4, indexOf(steps4, "4.2"), data)), "4.5");
  assert.equal(code(steps4, vtPreviousStep(steps4, indexOf(steps4, "4.5"), data)), "4.2");
  assert.equal(isVtStepApplicable(steps4[indexOf(steps4, "4.3")], data), false);
});

test("4.6 is skipped when 2.18 offers no initial training", () => {
  const data = quiz(true, {}, false);
  assert.equal(code(steps4, vtNextStep(steps4, indexOf(steps4, "4.5"), data)), "4.7");
});

test("an unanswered questionnaire skips nothing", () => {
  assert.equal(code(steps4, vtNextStep(steps4, indexOf(steps4, "4.2"), {})), "4.3");
});

test("a closed centre skips nothing", () => {
  const data = { ...quiz(false), VT1_12: "Fermée" };
  assert.equal(code(steps4, vtNextStep(steps4, indexOf(steps4, "4.2"), data)), "4.3");
});

test("coming back from Section 5 lands on the last applicable table", () => {
  assert.equal(code(steps4, vtLastStep(steps4, quiz(true))), "4.11");
  // 4.11 is quiz-governed: switched off, the last table is 4.10.
  const scholarships = VT_QUIZ_QUESTIONS.find((q) => q.tableId === "VT4_11")!.id;
  assert.equal(code(steps4, vtLastStep(steps4, quiz(true, { [scholarships]: false }))), "4.10");
});

test("Previous from the first table and Next from the last return null (the shell changes section)", () => {
  const data = quiz(true);
  assert.equal(vtPreviousStep(steps4, vtFirstStep(steps4, data), data), null);
  assert.equal(vtNextStep(steps4, vtLastStep(steps4, data), data), null);
});

test("'Table n of m' counts applicable tables only", () => {
  const data = quiz(true, { unemployedQualified: false });
  assert.deepEqual(vtStepPosition(steps4, indexOf(steps4, "4.4"), data), { number: 3, total: 10 });
  assert.equal(vtStepPosition(steps4, indexOf(steps4, "4.3"), data), null);
});

test("cross-table issues land on the later table of each pair", () => {
  for (const [issueFieldId, expected] of [
    ["VT4_2", "4.2"],
    ["VT4_5", "4.5"],
    ["VT4_6", "4.6"],
  ] as const) {
    assert.equal(code(steps4, vtStepOwningIssue(steps4, issueFieldId)), expected);
  }
  assert.equal(code(steps8, vtStepOwningIssue(steps8, "VT8_5_VP_M")), "8.5");
  assert.equal(code(steps8, vtStepOwningIssue(steps8, "VT8_3")), "8.3");
});

test("a cell issue belongs to its table", () => {
  assert.equal(code(steps4, vtStepOwningIssue(steps4, "s4q3_row2_fiMale")), "4.3");
});

test("an issue no table owns goes to the last applicable table, so Next cannot skip it", () => {
  const data = quiz(true);
  assert.equal(vtStepOwningIssue(steps4, "SOMETHING_ELSE"), -1);
  assert.equal(code(steps4, vtStepForIssue(steps4, "SOMETHING_ELSE", data)), "4.11");
});

test("every issue of an empty Section 4 or 8 is owned by one of its tables", () => {
  const data = quiz(true);
  for (const [s, steps] of [[s4, steps4], [s8, steps8]] as const) {
    const issues = validateSectionData(s, data, "fr");
    assert.ok(issues.length > 0, s.id);
    for (const issue of issues) {
      assert.ok(vtStepOwningIssue(steps, issue.fieldId) >= 0, `${s.id}: ${issue.fieldId} has no table`);
    }
  }
});

test("each table's Next sees only its own issues", () => {
  const data = quiz(true);
  const issues = validateSectionData(s4, data, "fr");
  const perStep = steps4.map((_, i) => vtStepIssues(steps4, i, issues, data));
  assert.equal(perStep.reduce((n, list) => n + list.length, 0), issues.length, "every issue is on exactly one table");
  const at43 = perStep[indexOf(steps4, "4.3")];
  assert.ok(at43.length > 0 && at43.every((i) => vtStepOwningIssue(steps4, i.fieldId) === indexOf(steps4, "4.3")));
});

test("the section screen's groups are the same steps: one per paper table", async () => {
  const { vtWizardSectionGroups } = await import("@/components/onefop/VtWizardSectionScreen");
  for (const [s, steps] of [[s4, steps4], [s8, steps8]] as const) {
    const groups = vtWizardSectionGroups(s, quiz(true), "fr");
    assert.deepEqual(
      groups.map((g) => g.fields.map((f) => f.id)),
      steps.map((st) => st.fields.map((f) => f.id)),
      s.id,
    );
  }
});

test("defect 10: table 4.3 English title matches the intended meaning", () => {
  const vt43Field = s4.fields.find((f) => f.paperCode === "4.3");
  assert.ok(vt43Field?.table?.vt, "4.3 must have table definitions");
  assert.equal(vt43Field.table.vt.title.fr, "Apprenants non occupés par spécialité");
  assert.equal(vt43Field.table.vt.title.en, "Unemployed working-age trainees by specialty");
});
