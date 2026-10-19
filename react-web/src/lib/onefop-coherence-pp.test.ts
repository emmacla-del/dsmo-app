import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCoherence } from "./onefop-coherence";
import type { FormData } from "./onefop-schema";

// The project form carried no coherence edit at all: every rule in
// onefop-coherence.ts is keyed to the employer forms' s22q0x / s3q0x cells,
// which a project file never holds. 4.5 handicap > 4.3 permanents recruited
// passed in silence while the identical mistake was flagged on an enterprise.
// All three rules below are advisory, as their enterprise equivalents are
// (CLAUDE.md §7, owner's decision of 2026-10-19).

const codes = (data: FormData, entityType = "projectProgram") =>
  checkCoherence(data, entityType).map((f) => f.code).sort();

test("4.5 handicap cannot exceed the permanents recruited in 4.3", () => {
  const data: FormData = {
    pp_s4q03_total_male_total: 3,
    pp_s4q05_total_permanent_male: 5,
  };
  assert.deepEqual(codes(data), ["PP_S4Q05_PERMANENT_EXCEEDS_TOTAL"]);
  const flag = checkCoherence(data, "projectProgram")[0];
  assert.match(flag.message.fr, /5 hommes recrutés en situation de handicap \(poste permanent\)/);
  assert.match(flag.message.fr, /3 hommes dans le total des recrutements permanents/);
  // The chip hangs on 4.5, and names 4.3's own cell as the other side.
  assert.equal(flag.fieldId, "PP_S4Q05");
  assert.deepEqual(flag.cells, [
    { fieldKey: "pp_s4q05_total_permanent_male", tableFieldId: "PP_S4Q05" },
    { fieldKey: "pp_s4q03_total_male_total", tableFieldId: "PP_S4Q03" },
  ]);
});

test("4.6 vulnerable cannot exceed the temporaries recruited in 4.4", () => {
  assert.deepEqual(
    codes({ pp_s4q04_total_female_total: 1, pp_s4q06_total_temporary_female: 4 }),
    ["PP_S4Q06_TEMPORARY_EXCEEDS_TOTAL"],
  );
});

test("a subset within its total says nothing", () => {
  assert.deepEqual(
    codes({
      pp_s4q03_total_male_total: 9,
      pp_s4q04_total_male_total: 4,
      pp_s4q05_total_permanent_male: 2,
      pp_s4q06_total_temporary_male: 4,
    }),
    [],
  );
});

test("4.1 against the permanent headcount of section 1, once 4.1 is complete", () => {
  const mismatch = { pp_s4q01_total_total_total: 12, PP_S1Q15: 15 };
  assert.deepEqual(codes(mismatch), ["PP_S4Q01_HEADCOUNT_MISMATCH"]);
  assert.match(checkCoherence(mismatch, "projectProgram")[0].message.fr, /4\.1 recense 12 permanents/);

  // Equal: nothing to say.
  assert.deepEqual(codes({ pp_s4q01_total_total_total: 15, PP_S1Q15: 15 }), []);
  // 4.1 still being filled — its grand total is blank while any cell is (T4).
  assert.deepEqual(codes({ PP_S1Q15: 15 }), []);
  assert.deepEqual(codes({ pp_s4q01_total_total_total: "", PP_S1Q15: 15 }), []);
  // The headcount not yet answered.
  assert.deepEqual(codes({ pp_s4q01_total_total_total: 12 }), []);
});

test("a stray digit in the permanent headcount is still caught", () => {
  // The ceiling used to resolve to n('') for a project: no field was mapped.
  assert.deepEqual(codes({ PP_S1Q15: 60000 }), ["PERMANENT_WORKERS_IMPLAUSIBLE"]);
  assert.deepEqual(codes({ PP_S1Q16: 60000 }), ["VACANCIES_IMPLAUSIBLE"]);
});

test("the employer rules are untouched by any of this", () => {
  // Same figures under the enterprise's own codes still flag, and a project
  // file never trips a rule written for s22q0x cells.
  assert.deepEqual(
    codes({ s22q01_total_male_total: 3, s22q04_total_permanent_male: 5 }, "enterprise"),
    // The diploma breakdown of those three recruits is empty, which the
    // enterprise form has always said so too.
    ["S22Q03_DIPLOMA_MISMATCH", "S22Q04_PERMANENT_EXCEEDS_TOTAL"],
  );
  assert.deepEqual(codes({ pp_s4q03_total_male_total: 3, pp_s4q05_total_permanent_male: 5 }, "enterprise"), []);
});
