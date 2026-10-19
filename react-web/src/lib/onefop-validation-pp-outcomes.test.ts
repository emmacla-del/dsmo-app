import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopSchema, OnefopSection } from "./onefop-schema";
import { validateSectionData } from "./onefop-validation";

// Section 3's outcomes grid used to be the one table nothing checked: it
// carries no response status of its own, so neither the wizard nor the
// server's REPORTED-table walk ever asked it for a figure. A project could
// tick an outcome in the preliminary questionnaire and file the section blank.

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

function outcomesSection(): OnefopSection {
  const pp = schema.entities["projectProgram"];
  assert.ok(pp, "projectProgram entity exists");
  const s3 = pp.sections.find((s) => s.id === "section3_projectProgram");
  assert.ok(s3, "section3_projectProgram exists");
  return s3;
}

const quiz = (config: Record<string, unknown>): FormData => ({
  _scopeConfig: { projectProgram: { completedAt: "2026-10-19T10:00:00.000Z", ...config } },
});

test("an outcome the quiz opened owes its realised figure", () => {
  const issues = validateSectionData(
    outcomesSection(),
    quiz({ noOutcomes: false, outcomes: ["employed", "trained"] }),
    "fr",
  );
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].message, /réalisations de la période/);
  assert.match(issues[0].message, /insérés comme employés/i);
  assert.match(issues[0].message, /formés dans les domaines divers/i);
});

test("the figures given, the section passes — 0 included", () => {
  const data = {
    ...quiz({ noOutcomes: false, outcomes: ["employed", "trained"] }),
    s3kpi_employed_current: 12,
    s3kpi_trained_current: 0,
  };
  assert.deepEqual(validateSectionData(outcomesSection(), data, "fr"), []);
});

test("a forecast is not the realised figure", () => {
  const data = {
    ...quiz({ noOutcomes: false, outcomes: ["employed"] }),
    s3kpi_employed_outlook_dec: 40,
  };
  const issues = validateSectionData(outcomesSection(), data, "fr");
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.match(issues[0].message, /insérés comme employés/i);
});

test("the two outlook columns are never demanded", () => {
  const data = {
    ...quiz({ noOutcomes: false, outcomes: ["employed"] }),
    s3kpi_employed_current: 3,
  };
  // Which December and which June they mean is still ONEFOP's to say, so a
  // blank forecast cannot block a declaration.
  assert.deepEqual(validateSectionData(outcomesSection(), data, "fr"), []);
});

test("« aucun bénéficiaire » owes nothing: the quiz already wrote the zeros", () => {
  const data = {
    ...quiz({ noOutcomes: true, outcomes: [] }),
    s3kpi_employed_current: 0,
    s3kpi_self_employed_current: 0,
    s3kpi_jobs_created_current: 0,
    s3kpi_trained_current: 0,
  };
  assert.deepEqual(validateSectionData(outcomesSection(), data, "fr"), []);
});

test("an unanswered preliminary questionnaire is not reported here", () => {
  // validateEntityData says that once, in its own words; this table stays quiet.
  assert.deepEqual(validateSectionData(outcomesSection(), {}, "fr"), []);
});

test("a figure that is not a whole count is refused, in any column", () => {
  const data = {
    ...quiz({ noOutcomes: false, outcomes: ["employed"] }),
    s3kpi_employed_current: 3,
    s3kpi_employed_outlook_june: -2,
  };
  const issues = validateSectionData(outcomesSection(), data, "fr");
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].fieldId, "s3kpi_employed_outlook_june");
});
