import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewCellChecks, sameRule } from "./dossier-cell-checks";

const recruited = {
  s22q01_total_male_total: 4, s22q01_total_female_total: 1, s22q01_total_total_total: 5,
  s22q02_total_male_total: 0, s22q02_total_female_total: 0, s22q02_total_total_total: 0,
};

test("an open finding whose figures disagree marks the cells it compares", () => {
  const data = { ...recruited, s22q03_workers_total_male_total: 2, s22q03_workers_total_female_total: 1, s22q03_workers_total_total_total: 3 };
  const { flags, notFound } = reviewCellChecks(data, "enterprise", ["S22Q03_DIPLOMA_MISMATCH"]);
  assert.ok(flags.length > 0);
  assert.ok(flags.every((flag) => flag.code === "S22Q03_DIPLOMA_MISMATCH"));
  const cells = flags.flatMap((flag) => flag.cells.map((cell) => cell.fieldKey));
  assert.ok(cells.includes("s22q01_total_male_total"), "the permanent total");
  assert.ok(cells.includes("s22q02_total_male_total"), "the temporary total");
  assert.ok(cells.includes("s22q03_workers_total_male_total"), "the diploma total it is compared with");
  assert.equal(notFound.size, 0);
});

test("a stored finding the figures no longer show is reported, not marked", () => {
  // 5 recruited, 5 by diploma: the stored S22Q03 warning came from the rule's old reading.
  const data = { ...recruited, s22q03_workers_total_male_total: 4, s22q03_workers_total_female_total: 1, s22q03_workers_total_total_total: 5 };
  const { flags, notFound } = reviewCellChecks(data, "enterprise", ["S22Q03_DIPLOMA_MISMATCH"]);
  assert.equal(flags.length, 0);
  assert.deepEqual([...notFound], ["S22Q03_DIPLOMA_MISMATCH"]);
});

test("a gap no stored finding reports is detected on review and marked", () => {
  const data = { ...recruited, s22q03_workers_total_male_total: 2, s22q03_workers_total_total_total: 2 };
  const { flags, detected, notFound } = reviewCellChecks(data, "enterprise", []);
  assert.ok(detected.length > 0);
  assert.ok(detected.every((flag) => flag.code === "S22Q03_DIPLOMA_MISMATCH"));
  assert.deepEqual(flags, detected, "detected gaps are marked like the others");
  assert.equal(notFound.size, 0);
});

test("a rule already reported or settled is not detected a second time, and quiz hints never are", () => {
  const data = { ...recruited, s22q03_workers_total_male_total: 2, s22q03_workers_total_total_total: 2 };
  assert.deepEqual(reviewCellChecks(data, "enterprise", ["S22Q03_DIPLOMA_MISMATCH"]).detected, []);
  const settled = reviewCellChecks(data, "enterprise", [], ["S22Q03_DIPLOMA_MISMATCH"]);
  assert.deepEqual(settled.detected, [], "explained by a reviewer");
  assert.deepEqual(settled.flags, [], "and no longer marked");
  assert.ok(reviewCellChecks(data, "enterprise", []).detected.every((flag) => !flag.code.startsWith("SCOPE_")));
});

test("a rule the checker does not restate is neither marked nor reported", () => {
  const { flags, detected, notFound } = reviewCellChecks({}, "vocationalTraining", ["VT_TRAINER_AGE_MISMATCH"]);
  assert.deepEqual(flags, []);
  assert.deepEqual(detected, []);
  assert.equal(notFound.size, 0);
  assert.equal(reviewCellChecks({}, "enterprise", ["MANDATORY_FIELD_MISSING"]).notFound.size, 0);
});

test("the server's contract suffix still names the checker's project rule", () => {
  assert.equal(sameRule("PP_S4Q05_PERMANENT_EXCEEDS_TOTAL", "PP_S4Q05"), true);
  assert.equal(sameRule("S22Q04_PERMANENT_EXCEEDS_TOTAL", "S22Q04_TEMPORARY_EXCEEDS_TOTAL"), false);
});
