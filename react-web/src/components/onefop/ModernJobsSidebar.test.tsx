import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopSchema, OnefopSection } from "@/lib/onefop-schema";
import { validateSectionData } from "@/lib/onefop-validation";
import { getSectionStatus } from "./ModernJobsSidebar";
import { getModernJobsTableDefinition } from "./tables/definitions/modernJobsTableDefinitions";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

function ppSection(id: string): OnefopSection {
  const section = schema.entities["projectProgram"].sections.find((s) => s.id === id);
  assert.ok(section, `${id} exists`);
  return section;
}

function statusOf(section: OnefopSection, data: FormData) {
  return getSectionStatus(section, data, validateSectionData(section, data, "en"), true);
}

// B4 (E2E 2026-10-17): these tables store their cells under the table id
// (s2_row…, s3kpi_…), not the field id, and were always "not started".
test("PP Section 2: a completed activity row makes the section complete", () => {
  const section = ppSection("section2_projectProgram");
  assert.equal(statusOf(section, {}), "not-started");
  const data: FormData = {
    s2_row1_description: "Placement des jeunes diplômés",
    s2_row1_targetPopulation: "2",
    s2_row1_supportType: "1",
    s2_row1_scope: "1",
    s2_row1_startDate: "03/2025",
    s2_row1_duration: "36",
  };
  assert.equal(statusOf(section, data), "complete");
});

test("PP Section 2: a half-filled activity row is not complete", () => {
  const section = ppSection("section2_projectProgram");
  assert.notEqual(statusOf(section, { s2_row1_description: "Formation" }), "complete");
});

test("PP Section 3: entered outcomes make the section complete, zeros included", () => {
  const section = ppSection("section3_projectProgram");
  assert.equal(statusOf(section, {}), "not-started");
  const data: FormData = {};
  for (const row of ["employed", "self_employed", "jobs_created", "trained"]) {
    for (const col of ["current", "outlook_dec", "outlook_june"]) data[`s3kpi_${row}_${col}`] = 0;
  }
  assert.equal(statusOf(section, data), "complete");
});

// B5: the csp_gender_age_table heading is the field's own question, not a
// fixed "recruitments during the quarter" caption shared by every table.
test("PP Section 4: each csp × sex × age table is titled by its own question", () => {
  const section = ppSection("section4_projectProgram");
  const titles = ["PP_S4Q01", "PP_S4Q02", "PP_S4Q03", "PP_S4Q04"].map((id) => {
    const field = section.fields.find((f) => f.id === id);
    assert.ok(field, `${id} exists`);
    const def = getModernJobsTableDefinition(field, {});
    assert.ok(def, `${id} has a definition`);
    assert.equal(def.caption, undefined);
    assert.deepEqual(def.title, field.label);
    return def.title.en;
  });
  assert.equal(new Set(titles).size, 4);
  assert.match(titles[0], /permanent workers .* count/);
  assert.match(titles[3], /temporary workers .* recruit/);
});
