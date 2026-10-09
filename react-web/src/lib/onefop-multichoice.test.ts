import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopSchema } from "./onefop-schema";
import { cleanHiddenDependentFields, isFieldVisible, normalizeMultiChoiceValues } from "./onefop-schema";

// A multiple-choice answer is always a list. A draft holding one as a single
// string is repaired on load and before hidden answers are erased.

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;
const vt = schema.entities.vocationalTraining;
const fieldById = new Map(vt.sections.flatMap((s) => s.fields).map((f) => [f.id, f]));

test("a single-string answer that is one of the options becomes a one-item list", () => {
  const out = normalizeMultiChoiceValues(vt, { VT6_5: "Autres/ Others" });
  assert.deepEqual(out.VT6_5, ["Autres/ Others"]);
});

test("its follow-up is then visible and survives hidden-answer cleaning", () => {
  // VT6_5 is itself shown only when VT6_1 is "Oui/ Yes".
  const draft = { VT6_1: "Oui/ Yes", VT6_5: "Autres/ Others", VT6_6: "Formation en ligne" };
  assert.equal(isFieldVisible(fieldById.get("VT6_6")!, draft), false);

  const normalized = normalizeMultiChoiceValues(vt, draft);
  assert.equal(isFieldVisible(fieldById.get("VT6_6")!, normalized), true);
  assert.equal(cleanHiddenDependentFields(vt, normalized).VT6_6, "Formation en ligne");
});

test("lists, unknown strings and checkbox fields without options are left untouched", () => {
  const data = {
    VT6_5: ["Autres/ Others"],
    VT6_8: "not an option",
    VT7_7: "Oui/ Yes", // no option list: its own legacy reader interprets it
  };
  const out = normalizeMultiChoiceValues(vt, data);
  assert.equal(out, data, "nothing to repair returns the same object");
  assert.equal(out.VT7_7, "Oui/ Yes");
});

test("non-checkbox fields are never wrapped", () => {
  const radio = vt.sections
    .flatMap((s) => s.fields)
    .find((f) => f.type === "radio" && f.options?.length);
  assert.ok(radio, "schema has a radio field with options");
  const value = radio.options![0].value;
  const out = normalizeMultiChoiceValues(vt, { [radio.id]: value });
  assert.equal(out[radio.id], value);
});
