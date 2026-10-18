import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopSchema } from "@/lib/onefop-schema";
import { getGuidedOnlyTableDefinition, getModernJobsTableDefinition } from "./definitions/modernJobsTableDefinitions";
import { resolveGuidedScope } from "./resolveGuidedScope";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

const section4 = schema.entities["projectProgram"].sections.find((s) => s.id === "section4_projectProgram");

function firstPrompt(fieldId: string, data: FormData = {}) {
  const field = section4?.fields.find((f) => f.id === fieldId);
  assert.ok(field, `${fieldId} exists`);
  const def = getModernJobsTableDefinition(field, data) ?? getGuidedOnlyTableDefinition(field, data);
  assert.ok(def, `${fieldId} has a definition`);
  const scope = resolveGuidedScope(def, data, "en");
  assert.ok(scope.questions.length > 0, `${fieldId} asks something`);
  return { first: scope.questions[0], scope };
}

// Guidé used the enterprise prompts for these tables: 4.1 asked about job
// applications, 4.2 about permanent recruits, 4.4 about first-job seekers.
test("PP Section 4 guided prompts follow each table's own question", () => {
  const q1 = firstPrompt("PP_S4Q01").first;
  assert.match(q1.prompt, /permanent workers .* did you count\?/);
  assert.equal(q1.contractType, "permanent");

  const q2 = firstPrompt("PP_S4Q02").first;
  assert.match(q2.prompt, /temporary workers .* did you count\?/);
  assert.equal(q2.contractType, "temporary");

  const q3 = firstPrompt("PP_S4Q03").first;
  assert.match(q3.prompt, /permanent workers .* did you recruit\?/);

  const q4 = firstPrompt("PP_S4Q04").first;
  assert.match(q4.prompt, /temporary workers .* did you recruit\?/);

  for (const id of ["PP_S4Q01", "PP_S4Q02", "PP_S4Q03", "PP_S4Q04"]) {
    assert.doesNotMatch(firstPrompt(id).first.prompt, /application|first job/i, id);
  }
});

test("PP Section 4 shows no enterprise CSP scope tags", () => {
  const data: FormData = { _scopeConfig: { recruit: true, recruit_csp: ["cadres"] } };
  assert.deepEqual(firstPrompt("PP_S4Q03", data).scope.activeScopeTags, []);
});

// Owner's decision 2026-10-18 (CLAUDE.md §21): 4.6 asks the nature of the
// vulnerability, as S22Q05 does in the five other questionnaires, where it
// used to ask the socio-professional category of 4.5.
test("PP 4.6 asks the natures of vulnerability, and writes their cells", () => {
  const field = section4?.fields.find((f) => f.id === "PP_S4Q06");
  assert.ok(field, "PP_S4Q06 exists");
  const def = getGuidedOnlyTableDefinition(field, {});
  assert.ok(def, "4.6 is a guided-only (named rows) table");
  assert.deepEqual(
    def.rows.map((r) => r.id),
    ["deplaces_internes", "refugies", "orphelins", "total"],
  );
  assert.equal(def.rowHeaderLabel?.fr, "Nature de la vulnérabilité");
  const cells = Object.values(def.rows[0].cells).map((c) => c.fieldKey);
  assert.ok(cells.includes("pp_s4q06_deplaces_internes_permanent_male"), cells.join(","));
  assert.equal(cells.filter((k) => /_cadres_|_foremen_|_workers_/.test(k)).length, 0);

  // The prompt names the group itself, not a category it belongs to
  // (firstPrompt resolves in English).
  const { first } = firstPrompt("PP_S4Q06");
  assert.match(first.prompt, /^How many internal displaced did you recruit as permanent workers\?$/);
  assert.doesNotMatch(first.prompt, /category/i);
});

test("PP 4.5 still asks by socio-professional category", () => {
  const { first } = firstPrompt("PP_S4Q05");
  assert.match(first.prompt, /in the "Executives" category/);
});
