import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopSchema } from "./onefop-schema";
import { prepareSubmissionData } from "./onefop-submission";
import { validateEntityData } from "./onefop-validation";
import { QUIZ_ISSUE_FIELD_ID } from "./onefop-validation";
import { isVtQuizComplete, missingVtTableCells, readVtQuiz, vtStatusKey, vtTableStatus, type VtQuizAnswers } from "./vt-quiz";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8")) as OnefopSchema;
const vt = schema.entities.vocationalTraining;
const field = (id: string) => vt.sections.flatMap((s) => s.fields).find((f) => f.id === id)!;

const ALL_NO: VtQuizAnswers = {
  unemployedQualified: false,
  informalSector: false,
  vulnerable: false,
  scholarships: false,
  formerStudents: false,
  trainersWithDisability: false,
  completedAt: "2026-10-08",
};
const withQuiz = (answers: VtQuizAnswers, extra: FormData = {}): FormData => ({
  _scopeConfig: { vocationalTraining: answers },
  ...extra,
});

test("a table's status follows its quiz question; tables outside the quiz are always reported", () => {
  const data = withQuiz({ ...ALL_NO, vulnerable: true });
  assert.equal(vtTableStatus("VT4_9", data), "REPORTED");
  assert.equal(vtTableStatus("VT4_3", data), "NONE");
  assert.equal(vtTableStatus("VT4_1", data), "REPORTED");
  assert.equal(vtTableStatus("VT8_8", data), "REPORTED");
  assert.equal(vtTableStatus("VT4_3", {}), undefined, "unanswered quiz leaves the table undecided");
});

test("6.3 follows its follow-up question, and is NONE when there were no former students", () => {
  assert.equal(vtTableStatus("VT6_13", withQuiz({ ...ALL_NO })), "NONE");
  assert.equal(vtTableStatus("VT6_13", withQuiz({ ...ALL_NO, formerStudents: true, formerStudentsPlaced: true })), "REPORTED");
  assert.equal(vtTableStatus("VT6_13", withQuiz({ ...ALL_NO, formerStudents: true })), undefined);
  assert.equal(isVtQuizComplete({ ...ALL_NO, formerStudents: true }), false, "the follow-up must be answered");
  assert.equal(isVtQuizComplete(ALL_NO), true);
});

test("4.6 applies only when 2.1.14 includes Formation Initiale", () => {
  assert.equal(vtTableStatus("VT4_6", { VT2_18: ["Formation Initiale (FI)/ Initial Training (IT)"] }), "REPORTED");
  assert.equal(vtTableStatus("VT4_6", { VT2_18: ["Formation Continue (FC)/ Continuing Training (CT)"] }), "NONE");
});

test("submission: Non gives zeros to fixed tables and no rows to row-by-row tables; quiz keys stripped", () => {
  const out = prepareSubmissionData(vt, withQuiz(ALL_NO, { s4q3_row1_specialtyText: "Couture", s4q3_row1_fiMale: "3" }));
  assert.equal(out[vtStatusKey("VT4_9")], "NONE");
  assert.equal(out[field("VT4_9").table!.matrix![0][0]], 0, "fixed-row NONE table is zeros");
  assert.equal(out[vtStatusKey("VT4_3")], "NONE");
  assert.equal(out.s4q3_row1_specialtyText, undefined, "row-by-row NONE table has no rows");
  assert.equal(out.s4q3_row1_fiMale, undefined);
  assert.equal(out[vtStatusKey("VT4_1")], "REPORTED");
  assert.equal(out._scopeConfig, undefined);
});

test("submission: a closed centre gets no table statuses", () => {
  const out = prepareSubmissionData(vt, withQuiz(ALL_NO, { VT1_12: "Fermée/ Closed" }));
  assert.equal(out[vtStatusKey("VT4_1")], undefined);
  assert.equal(out[vtStatusKey("VT4_9")], undefined);
});

test("validation: an unanswered quiz is one issue; a closed centre has no quiz", () => {
  const ids = validateEntityData(vt, { VT1_12: "Fonctionnelle/ Functional" }, "fr").map((i) => i.fieldId);
  assert.ok(ids.includes(QUIZ_ISSUE_FIELD_ID));
  const closed = validateEntityData(vt, { VT1_12: "Fermée/ Closed" }, "fr").map((i) => i.fieldId);
  assert.ok(!closed.includes(QUIZ_ISSUE_FIELD_ID));
  assert.equal(readVtQuiz({}), null);
});

test("reported tables: fixed rows need every count; row-by-row tables need a complete started row", () => {
  const vt49 = field("VT4_9");
  const fixed = missingVtTableCells(vt49, {});
  assert.ok(fixed.length > 0 && fixed.every((id) => !id.endsWith("_total")), "computed totals are never required");

  const vt43 = field("VT4_3");
  assert.deepEqual(missingVtTableCells(vt43, {}), ["VT4_3"], "at least one row");
  const started = missingVtTableCells(vt43, { s4q3_row1_specialtyText: "Couture" });
  assert.deepEqual(started, ["s4q3_row1_fiMale", "s4q3_row1_fiFemale", "s4q3_row1_fcMale", "s4q3_row1_fcFemale"]);
  assert.deepEqual(missingVtTableCells(vt43, { s4q3_row1_specialtyText: "Couture", s4q3_row1_fiMale: "0", s4q3_row1_fiFemale: 0, s4q3_row1_fcMale: "2", s4q3_row1_fcFemale: "1" }), []);
});

test("5.2: 'homologué' is required only when the curriculum exists", () => {
  const vt55 = field("VT5_5");
  const [name, has, approved] = vt55.table!.matrix![0];
  assert.deepEqual(missingVtTableCells(vt55, { [name]: "Couture", [has]: false }), []);
  assert.deepEqual(missingVtTableCells(vt55, { [name]: "Couture", [has]: true }), [approved]);
});

test("specialty names are not mistaken for negative numbers", () => {
  const data = withQuiz({ ...ALL_NO, unemployedQualified: true }, {
    VT1_12: "Fonctionnelle/ Functional",
    s4q3_row1_specialtyText: "Couture",
    s4q3_row1_fiMale: "1", s4q3_row1_fiFemale: "0", s4q3_row1_fcMale: "0", s4q3_row1_fcFemale: "0",
  });
  const issues = validateEntityData(vt, data, "fr").filter((i) => i.fieldId.startsWith("s4q3") || i.fieldId === "VT4_3");
  assert.deepEqual(issues, []);
});
