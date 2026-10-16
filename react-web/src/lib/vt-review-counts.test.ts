import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import type { FormData } from "./onefop-schema";
import { VT_QUIZ_QUESTIONS, vtQuizQuestionForTable } from "./vt-quiz";
import { vtSectionTableCounts } from "./vt-review-counts";

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
