import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import { vtWizardBlockRequiredStats, vtWizardSectionStats } from "@/components/onefop/vt-wizard-utils";
import type { FormData } from "./onefop-schema";
import { VT_QUIZ_QUESTIONS, vtQuizQuestionForTable } from "./vt-quiz";
import { VT85_FIELD_IDS, vtSectionTableCounts } from "./vt-review-counts";

const vt = schemaEntity("vocationalTraining");
const s4 = vt.sections.find((s) => s.id === "section4_vocationalTraining")!;
const s4Tables = s4.fields.filter((f) => f.table?.matrix);

function quiz(overrides: Record<string, boolean> = {}): FormData {
  const answers: Record<string, boolean> = {};
  for (const q of VT_QUIZ_QUESTIONS) answers[q.id] = true;
  return { _scopeConfig: { vocationalTraining: { ...answers, ...overrides } }, VT2_18: ["Formation Initiale (FI)"] };
}

test("Section 4 is counted by its tables, not as 0 / 0", () => {
  const counts = vtSectionTableCounts(s4, quiz(), []);
  assert.equal(counts.total, s4Tables.length);
  assert.equal(counts.complete, 0, "nothing entered yet");
});

test("a table the preliminary questionnaire switched off is not counted", () => {
  const governed = s4Tables.find((f) => vtQuizQuestionForTable(f.id));
  assert.ok(governed, "some Section 4 table depends on the quiz");
  const q = vtQuizQuestionForTable(governed!.id)!;
  const counts = vtSectionTableCounts(s4, quiz({ [q.id]: false }), []);
  assert.ok(counts.total < s4Tables.length);
});

test("a table is complete with a figure and no issue on it", () => {
  const t41 = s4Tables.find((f) => f.id === "VT4_1")!;
  const data = { ...quiz(), [t41.table!.matrix![0][0]]: 3 };
  assert.equal(vtSectionTableCounts(s4, data, []).complete, 1);
  assert.equal(vtSectionTableCounts(s4, data, [{ fieldId: t41.table!.matrix![1][0] }]).complete, 0, "an issue in it");
});

test("a closed centre's Section 4 counts nothing", () => {
  assert.deepEqual(vtSectionTableCounts(s4, { VT1_12: "Fermée/ Closed" }, []), { complete: 0, total: 0 });
});

// Defect 14 (2026-10-16 run): 8.5's six status × sex fields are one table on
// screen; the review read "6 / 6 questions · 7 / 7 tables" for Section 8.
const s8 = vt.sections.find((s) => s.id === "section8_vocationalTraining")!;

test("Section 8 reads 0 questions and 8 tables: 8.5 is one table", () => {
  assert.deepEqual(vtWizardSectionStats(s8, quiz()), { filled: 0, total: 0 });
  const counts = vtSectionTableCounts(s8, quiz(), []);
  assert.deepEqual(counts, { complete: 0, total: 8 });
  // The sidebar counts 8.5 once too, and only once all six cells are answered.
  const vt85Fields = s8.fields.filter((f) => VT85_FIELD_IDS.includes(f.id as (typeof VT85_FIELD_IDS)[number]));
  assert.deepEqual(vtWizardBlockRequiredStats(vt85Fields, quiz()), { filled: 0, total: 1 });
  const five: FormData = { ...quiz(), VT8_5_VP_M: 1, VT8_5_VP_F: 0, VT8_5_VNP_M: 0, VT8_5_VNP_F: 0, VT8_5_PERM_M: 2 };
  assert.deepEqual(vtWizardBlockRequiredStats(vt85Fields, five), { filled: 0, total: 1 });
  assert.deepEqual(vtWizardBlockRequiredStats(vt85Fields, { ...five, VT8_5_PERM_F: 0 }), { filled: 1, total: 1 });
});

test("8.5 is complete with a figure and no issue on its six fields", () => {
  const data: FormData = { ...quiz(), VT8_5_PERM_M: 2 };
  const without = vtSectionTableCounts(s8, quiz(), []).complete;
  assert.equal(vtSectionTableCounts(s8, data, []).complete, without + 1);
  assert.equal(vtSectionTableCounts(s8, data, [{ fieldId: "VT8_5_PERM_F" }]).complete, without);
});
