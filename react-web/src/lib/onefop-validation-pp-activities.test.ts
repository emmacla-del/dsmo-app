import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopField, OnefopSchema, OnefopSection } from "./onefop-schema";
import { validateSectionData } from "./onefop-validation";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

function getPpActivitiesSection(): OnefopSection {
  const pp = schema.entities["projectProgram"];
  assert.ok(pp, "projectProgram entity exists");
  const s2 = pp.sections.find((s) => s.id === "section2_projectProgram");
  assert.ok(s2, "section2_projectProgram exists");
  return s2;
}

test("PP_S2_ACTIVITIES: an untouched empty table produces no validation issues", () => {
  const section = getPpActivitiesSection();
  const data: FormData = {};
  const issues = validateSectionData(section, data, "fr");
  assert.deepEqual(issues, []);
});

test("PP_S2_ACTIVITIES: a fully completed row produces no validation issues", () => {
  const section = getPpActivitiesSection();
  const data: FormData = {
    s2_row1_description: "Formation en couture et confection",
    s2_row1_targetPopulation: "1", // Jeune non diplômé
    s2_row1_supportType: "1", // Gratuit
    s2_row1_scope: "3", // Local
    s2_row1_startDate: "01/2026",
    s2_row1_duration: "6",
  };
  const issues = validateSectionData(section, data, "fr");
  assert.deepEqual(issues, []);
});

test("PP_S2_ACTIVITIES: a partially started row flags all remaining missing fields", () => {
  const section = getPpActivitiesSection();
  const data: FormData = {
    s2_row1_description: "Formation en couture",
    // targetPopulation, supportType, scope, startDate, duration missing
  };
  const issuesFr = validateSectionData(section, data, "fr");
  assert.equal(issuesFr.length, 5);

  const missingIds = issuesFr.map((i) => i.fieldId);
  assert.deepEqual(missingIds, [
    "s2_row1_targetPopulation",
    "s2_row1_supportType",
    "s2_row1_scope",
    "s2_row1_startDate",
    "s2_row1_duration",
  ]);

  // English messages
  const issuesEn = validateSectionData(section, data, "en");
  assert.equal(issuesEn.length, 5);
  assert.ok(issuesEn[0].message.includes("Row 1"));
  assert.ok(issuesEn[0].message.includes("Target population"));
});

test("PP_S2_ACTIVITIES: duration must be non-negative number", () => {
  const section = getPpActivitiesSection();
  const data: FormData = {
    s2_row1_description: "Formation en couture",
    s2_row1_targetPopulation: "1",
    s2_row1_supportType: "1",
    s2_row1_scope: "3",
    s2_row1_startDate: "01/2026",
    s2_row1_duration: "-2",
  };
  const issues = validateSectionData(section, data, "fr");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].fieldId, "s2_row1_duration");
  assert.ok(issues[0].message.includes("≥ 0"));
});

test("PP_S2_ACTIVITIES: multiple rows validate independently (Row 1 complete, Row 2 partial, Row 3 untouched)", () => {
  const section = getPpActivitiesSection();
  const data: FormData = {
    // Row 1: complete
    s2_row1_description: "Projet A",
    s2_row1_targetPopulation: "2",
    s2_row1_supportType: "2",
    s2_row1_scope: "1",
    s2_row1_startDate: "03/2026",
    s2_row1_duration: "12",

    // Row 2: partial (only targetPopulation chosen)
    s2_row2_targetPopulation: "3",

    // Row 3..13: completely empty
  };
  const issues = validateSectionData(section, data, "fr");
  assert.equal(issues.length, 5);
  const row2MissingIds = issues.map((i) => i.fieldId);
  assert.deepEqual(row2MissingIds, [
    "s2_row2_description",
    "s2_row2_supportType",
    "s2_row2_scope",
    "s2_row2_startDate",
    "s2_row2_duration",
  ]);
});
