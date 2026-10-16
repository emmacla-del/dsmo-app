import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { schemaEntity } from "@/test/schema";
import type { FormData, OnefopField } from "./onefop-schema";
import { VT_ADVISORY_RULES, vtAdvisoryIssues } from "./vt-advisory-coherence";

// The advisory 4.2/4.7, 4.2/4.8 and 4.7/4.10 checks, computed in the
// browser so they show at once (CLAUDE.md §7: advisory until domain review).

const s4 = schemaEntity("vocationalTraining").sections.find((s) => s.id === "section4_vocationalTraining")!;
const field = (id: string) => s4.fields.find((f) => f.id === id) as OnefopField;

/** A complete table of zeros: every row of a fixed-row table, the first of a row-by-row one. */
function filled(fieldId: string): FormData {
  const f = field(fieldId);
  const vt = f.table!.vt!;
  const rows = vt.progressiveRows || vt.isRoster ? f.table!.matrix!.slice(0, 1) : f.table!.matrix!;
  const out: FormData = {};
  for (const rowIds of rows) {
    rowIds.forEach((cellId, c) => {
      const kind = vt.cells[c]?.kind;
      if (kind === "number") out[cellId] = 0;
      else if (kind === "text") out[cellId] = "Test";
    });
  }
  return out;
}
const all = (...ids: string[]) => Object.assign({}, ...ids.map(filled)) as FormData;

test("4.2 against the 4.7 entrants, by sex, with the server's figures", () => {
  const data = { ...all("VT4_2", "VT4_7"), s4q2_cap_male: 10, s4q2_cap_female: 7, s4q7_age_18_entrant_male: 8, s4q7_age_19_entrant_female: "7" };
  const issues = vtAdvisoryIssues(s4.fields, data);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "VT_TRAINEE_AGE_ENTRANT_MISMATCH");
  assert.deepEqual(issues[0].tables, ["VT4_2", "VT4_7"]);
  assert.deepEqual(issues[0].bySex, [{ sex: "male", first: 10, second: 8 }], "women agree (7 = 7), so only men are listed");
});

test("leavers and dropouts of 4.7 are not counted as entrants, and 4.7 leavers are compared with 4.10", () => {
  const data = {
    ...all("VT4_2", "VT4_7", "VT4_10"),
    s4q2_cap_male: 5,
    s4q7_age_18_entrant_male: 5,
    s4q7_age_18_sortant_male: 3,
    s4q7_age_18_abandon_male: 9,
    s4q10_row1_male: 4,
  };
  const issues = vtAdvisoryIssues(s4.fields, data);
  assert.deepEqual(
    issues.map((i) => [i.code, i.bySex]),
    [["VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH", [{ sex: "male", first: 3, second: 4 }]]],
  );
});

test("all zeros, or equal totals, raise nothing", () => {
  assert.deepEqual(vtAdvisoryIssues(s4.fields, all("VT4_2", "VT4_7", "VT4_8", "VT4_10")), []);
  const data = { ...all("VT4_2", "VT4_8"), s4q2_cap_female: 4, s4q8_primaire_entrant_female: 4 };
  assert.deepEqual(vtAdvisoryIssues(s4.fields, data), []);
});

test("nothing is said until both tables of a pair are complete", () => {
  const partial47 = Object.fromEntries(Object.entries(filled("VT4_7")).slice(1));
  assert.deepEqual(vtAdvisoryIssues(s4.fields, { ...filled("VT4_2"), ...partial47, s4q2_cap_male: 3 }), []);
  assert.deepEqual(vtAdvisoryIssues(s4.fields, { ...filled("VT4_2"), s4q2_cap_male: 3 }), []);
  assert.equal(vtAdvisoryIssues(s4.fields, { ...all("VT4_2", "VT4_7"), s4q2_cap_male: 3 }).length, 1);
});

test("a blank or unreadable cell counts 0, as on the server", () => {
  const data = { ...all("VT4_2", "VT4_8"), s4q2_cap_male: "abc", s4q8_primaire_entrant_male: 2 };
  assert.deepEqual(vtAdvisoryIssues(s4.fields, data)[0].bySex, [{ sex: "male", first: 0, second: 2 }]);
});

test("4.10 switched off by the preliminary questionnaire counts 0 and is complete, as the submission sends it", () => {
  const off = { _scopeConfig: { vocationalTraining: { formerStudents: false } } };
  const data = { ...off, ...all("VT4_2", "VT4_7"), s4q7_age_18_sortant_male: 3, s4q10_row1_male: 3 };
  const issues = vtAdvisoryIssues(s4.fields, data);
  assert.deepEqual(
    issues.map((i) => [i.code, i.offTables, i.bySex]),
    [["VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH", ["VT4_10"], [{ sex: "male", first: 3, second: 0 }]]],
    "a figure left in 4.10 before it was switched off is not counted",
  );
  assert.deepEqual(vtAdvisoryIssues(s4.fields, { ...off, ...all("VT4_2", "VT4_7") }), [], "no leavers: nothing to say");
  const on = { _scopeConfig: { vocationalTraining: { formerStudents: true } } };
  assert.deepEqual(vtAdvisoryIssues(s4.fields, { ...on, ...all("VT4_2", "VT4_7"), s4q7_age_18_sortant_male: 3 }), [], "4.10 asked and empty: wait for it");
});

// ── The browser copy must match the server's rules (checkVtCoherence) ──
// The server sums fixed row lists; the browser sums the schema's cells.
// If either side changes its rows, keys or codes, this fails.

const servicePath = join(process.cwd(), "..", "src", "questionnaires", "questionnaires.service.ts");

test("the server sums the same rows and cells, under the same codes", { skip: !existsSync(servicePath) && "backend not checked out" }, () => {
  const src = readFileSync(servicePath, "utf-8");
  const list = (name: string) => {
    const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
    assert.ok(m, `${name} not found in questionnaires.service.ts`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  const schemaRows = (id: string, re: RegExp) =>
    field(id).table!.matrix!.flat().map((c) => c.match(re)?.[1]).filter((x): x is string => !!x);

  assert.deepEqual(schemaRows("VT4_2", /^s4q2_(.+)_male$/), list("proDiplomaRows"));
  assert.deepEqual(schemaRows("VT4_7", /^s4q7_(.+)_entrant_male$/), list("ageBandRows"));
  assert.deepEqual(schemaRows("VT4_7", /^s4q7_(.+)_sortant_male$/), list("ageBandRows"));
  assert.deepEqual(schemaRows("VT4_8", /^s4q8_(.+)_entrant_male$/), list("eduLevelRows"));
  assert.equal(field("VT4_10").table!.matrix!.length, 10);
  assert.match(src, /for \(let i = 1; i <= 10; i\+\+\) \{\s*s410_m \+= n\(`s4q10_row\$\{i\}_male`\);/);

  for (const key of [
    "s4q2_${d}_male",
    "s4q7_${a}_entrant_male",
    "s4q8_${l}_entrant_male",
    "s4q7_${a}_sortant_male",
  ]) {
    assert.ok(src.includes("`" + key + "`"), `server key ${key}`);
  }
  for (const rule of VT_ADVISORY_RULES) assert.ok(src.includes(`code: '${rule.code}'`), rule.code);
});
