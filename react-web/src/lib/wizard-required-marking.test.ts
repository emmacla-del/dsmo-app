import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopField, OnefopSchema } from "./onefop-schema";
import { OPTIONAL_OVERRIDES, isOptionalField } from "./onefop-validation";
import { vtWizardBlockRequiredStats, vtWizardBlockSummary } from "@/components/onefop/vt-wizard-utils";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;
const allFields = Object.values(schema.entities).flatMap((e) => e.sections.flatMap((s) => s.fields));
const schemaField = (id: string) => allFields.find((f) => f.id === id)!;

function field(id: string, required: boolean, extra: Partial<OnefopField> = {}): OnefopField {
  return { id, type: "text", required, label: { fr: id, en: id }, ...extra } as OnefopField;
}

// ── Optional detection ───────────────────────────────────────────────────────

test("isOptionalField: schema required=false is optional", () => {
  assert.equal(isOptionalField(field("X", false)), true);
  assert.equal(isOptionalField(schemaField("VT1_15_TEL2")), true);
});

test("isOptionalField: schema required=true is not optional", () => {
  assert.equal(isOptionalField(field("X", true)), false);
  assert.equal(schemaField("VT1_2").required, true);
  assert.equal(isOptionalField(schemaField("VT1_2")), false);
});

test("isOptionalField: OPTIONAL_OVERRIDES wins over a schema required=true", () => {
  // The dismissal reasons 2/3 are required in the schema but optional here.
  const reason2 = schemaField("S3Q02_REASON_2_TEXT");
  assert.equal(reason2.required, true);
  assert.equal(isOptionalField(reason2), true);
  for (const id of OPTIONAL_OVERRIDES) assert.equal(isOptionalField(field(id, true)), true, id);
});

// ── Required questions left in a VT block ────────────────────────────────────

test("only required questions are counted; optional ones never hold a block back", () => {
  const fields = [field("A", true), field("B", true), field("C", false)];
  assert.deepEqual(vtWizardBlockRequiredStats(fields, {}), { filled: 0, total: 2 });
  const partial = vtWizardBlockSummary(fields, "Bloc", { A: "x", C: "y" }, new Set());
  assert.equal(partial.remaining, 1);
  assert.equal(partial.status, "inProgress");
  const done = vtWizardBlockSummary(fields, "Bloc", { A: "x", B: "y" }, new Set());
  assert.equal(done.remaining, 0);
  assert.equal(done.status, "complete");
});

test("a not-started block reports every required question as remaining", () => {
  const s = vtWizardBlockSummary([field("A", true), field("B", true)], "Bloc", {}, new Set());
  assert.equal(s.status, "notStarted");
  assert.equal(s.remaining, 2);
});

test("blank strings and empty lists are not answers", () => {
  const fields = [field("A", true), field("B", true, { type: "checkbox" } as Partial<OnefopField>)];
  assert.equal(vtWizardBlockSummary(fields, "Bloc", { A: "   ", B: [] }, new Set()).remaining, 2);
});

test("hidden questions are excluded", () => {
  const parent = field("P", true, { type: "radio" } as Partial<OnefopField>);
  const child = field("Q", true, { visibility: { dependsOn: "P", dependsValue: "Oui/ Yes" } } as Partial<OnefopField>);
  const fields = [parent, child];
  assert.equal(vtWizardBlockSummary(fields, "Bloc", { P: "Non/ No" }, new Set()).status, "complete");
  const shown = vtWizardBlockSummary(fields, "Bloc", { P: "Oui/ Yes" }, new Set());
  assert.equal(shown.remaining, 1);
  assert.equal(shown.status, "inProgress");
});

test("an OPTIONAL_OVERRIDES id is not counted as required", () => {
  const s = vtWizardBlockSummary([field("A", true), field("S3Q02_REASON_2_TEXT", true)], "Bloc", { A: "x" }, new Set());
  assert.equal(s.remaining, 0);
  assert.equal(s.status, "complete");
});

test("errors win over complete and in-progress", () => {
  const fields = [field("A", true), field("B", true)];
  const complete = vtWizardBlockSummary(fields, "Bloc", { A: "x", B: "y" }, new Set(["B"]));
  assert.equal(complete.status, "needsAttention");
  assert.equal(complete.errors, 1);
  const partial = vtWizardBlockSummary(fields, "Bloc", { A: "x" }, new Set(["A", "B"]));
  assert.equal(partial.status, "needsAttention");
  assert.equal(partial.errors, 2);
  // An issue on a hidden question does not count.
  const hidden = field("H", true, { visibility: { dependsOn: "A", dependsValue: "z" } } as Partial<OnefopField>);
  assert.equal(vtWizardBlockSummary([...fields, hidden], "Bloc", { A: "x", B: "y" }, new Set(["H"])).status, "complete");
});

test("a block with nothing required is complete, not 'left to fill'", () => {
  const s = vtWizardBlockSummary([field("C", false)], "Bloc", {}, new Set());
  assert.equal(s.status, "complete");
  assert.equal(s.remaining, 0);
});

// ── Training-centre tables: the preliminary quiz decides ─────────────────────

const quiz = (answer: boolean | undefined): FormData =>
  answer === undefined ? {} : { _scopeConfig: { vocationalTraining: { unemployedQualified: answer } } };

test("a table the quiz answered Non is not counted", () => {
  const s = vtWizardBlockSummary([schemaField("VT4_3")], "Bloc", quiz(false), new Set());
  assert.equal(s.status, "complete");
  assert.equal(s.remaining, 0);
});

test("a table the quiz answered Oui counts until it is filled", () => {
  const s = vtWizardBlockSummary([schemaField("VT4_3")], "Bloc", quiz(true), new Set());
  assert.equal(s.remaining, 1);
  assert.notEqual(s.status, "complete");
});

test("a table whose quiz question is unanswered counts as not answered", () => {
  assert.deepEqual(vtWizardBlockRequiredStats([schemaField("VT4_3")], quiz(undefined)), { filled: 0, total: 1 });
});

test("a closed centre's tables are not counted", () => {
  const data: FormData = { ...quiz(true), VT1_12: "Fermée" };
  assert.deepEqual(vtWizardBlockRequiredStats([schemaField("VT4_3")], data), { filled: 0, total: 0 });
});
