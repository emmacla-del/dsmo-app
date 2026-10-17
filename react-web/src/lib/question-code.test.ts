import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopSchema } from "./onefop-schema";
import { isDisplayableQuestionCode, questionCodeText, splitQuestionCode } from "./question-code";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

// B7 (E2E 2026-10-17): the employer forms' paperCode is an internal id, not
// a number the respondent can find on paper, and §8 keeps technical codes
// away from respondents. The training-centre form's numbering is real and
// stays.
test("a training-centre form number is shown", () => {
  for (const code of ["1.1", "4.10", "2.1.7", "8"]) {
    assert.equal(isDisplayableQuestionCode(code), true, code);
  }
});

test("an internal question id is not shown", () => {
  for (const code of ["S0Q01", "S21Q01", "PP_S4Q02", "S22Q05_ENTERPRISE", "VT4_1"]) {
    assert.equal(isDisplayableQuestionCode(code), false, code);
  }
});

test("no code at all is not shown", () => {
  for (const code of [null, undefined, "", "  "]) {
    assert.equal(isDisplayableQuestionCode(code), false, String(code));
  }
});

test("every employer paper code is hidden, every VT one is shown", () => {
  const employer = ["enterprise", "cooperative", "ctd", "ong", "administration", "projectProgram"];
  for (const key of employer) {
    for (const sec of schema.entities[key].sections) {
      for (const f of sec.fields) {
        if (!f.paperCode) continue;
        assert.equal(isDisplayableQuestionCode(f.paperCode), false, `${key}.${f.paperCode}`);
      }
    }
  }
  let shown = 0;
  for (const sec of schema.entities["vocationalTraining"].sections) {
    for (const f of sec.fields) {
      if (!f.paperCode) continue;
      assert.equal(isDisplayableQuestionCode(f.paperCode), true, `vocationalTraining.${f.paperCode}`);
      shown += 1;
    }
  }
  assert.ok(shown > 100, `expected the VT form to keep its numbering, saw ${shown}`);
});

// The code is still split off the label, shown or not: a label that embeds it
// must not be left with it sitting inside the question text.
test("an embedded code is taken out of the question text either way", () => {
  assert.deepEqual(splitQuestionCode("S22Q05", "S22Q05 - Combien de travailleurs…"), {
    code: "S22Q05",
    text: "Combien de travailleurs…",
  });
  assert.deepEqual(splitQuestionCode("4.10", "4.10 Combien de sortants…"), {
    code: "4.10",
    text: "Combien de sortants…",
  });
});

test("the plain-text form keeps a form number and drops an internal id", () => {
  assert.equal(questionCodeText("4.10", "Combien de sortants…"), "4.10 Combien de sortants…");
  assert.equal(questionCodeText("S0Q01", "Nom complet du répondant"), "Nom complet du répondant");
});
