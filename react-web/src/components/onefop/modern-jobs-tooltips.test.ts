import { test } from "node:test";
import assert from "node:assert/strict";
import { getModernJobsTooltip, MODERN_JOBS_TOOLTIPS } from "./modern-jobs-tooltips";
import { loadOnefopSchema } from "@/test/schema";

/**
 * A definition is attached by field id. FieldRenderer used to fall back to
 * the paper code, and every form numbers its Section 1 questions S1Q01,
 * S1Q10, S1Q11 — so the enterprise's three definitions were served on
 * whatever question carried the same number on the five other forms.
 */

/** The questions that used to be given someone else's definition. */
const WRONGLY_DEFINED = [
  ["projectProgram", "PP_S1Q01", "Type d'entité"],
  ["projectProgram", "PP_S1Q10", "Objectif ou mission principale"],
  ["projectProgram", "PP_S1Q11", "Siège social"],
  ["cooperative", "COOP_S1Q01", "Nom de la coopérative"],
  ["cooperative", "COOP_S1Q10_OTHER", "Précisez"],
  ["ctd", "CTD_S1Q01", "Type de CTD"],
  ["ong", "ONG_S1Q01", "Nom de l'ONG"],
  ["administration", "ADMIN_S1Q01", "Nom de l'administration"],
  ["administration", "ADMIN_S1Q10", "Combien de projets ?"],
  ["administration", "ADMIN_S1Q11", "Existence de structures sous tutelle ?"],
] as const;

test("a question with no definition of its own shows none", () => {
  for (const [entityType, fieldId, question] of WRONGLY_DEFINED) {
    assert.equal(
      getModernJobsTooltip(fieldId, entityType),
      null,
      `${fieldId} (${question}) still carries a definition`,
    );
  }
});

// The two that mattered most: the question IS about staffing, so the
// enterprise definition read plausibly — and it was off by one.
test("a staffing question is defined as the count it actually asks for", () => {
  const permanent = MODERN_JOBS_TOOLTIPS.S1Q10;
  const vacancies = MODERN_JOBS_TOOLTIPS.S1Q11;
  assert.notEqual(permanent.fr, vacancies.fr);

  // « Nombre d'employés permanents » — was given the vacancies definition.
  assert.deepEqual(getModernJobsTooltip("COOP_S1Q11", "cooperative"), permanent);
  // « Nombre de poste vacant » — was given the headcount definition.
  assert.deepEqual(getModernJobsTooltip("CTD_S1Q10", "ctd"), vacancies);

  // And the four that had the right definition written but unattached.
  assert.deepEqual(getModernJobsTooltip("CTD_S1Q09", "ctd"), permanent);
  assert.deepEqual(getModernJobsTooltip("COOP_S1Q12", "cooperative"), vacancies);
  assert.deepEqual(getModernJobsTooltip("PP_S1Q15", "projectProgram"), permanent);
  assert.deepEqual(getModernJobsTooltip("PP_S1Q16", "projectProgram"), vacancies);
});

// A round may be quarterly, half-yearly or annual; its bounds are printed
// once on the masthead (owner's decision, 2026-10-18).
test("a period-based definition does not name a quarter", () => {
  for (const [key, text] of Object.entries(MODERN_JOBS_TOOLTIPS)) {
    assert.ok(!/trimestre|quarter/i.test(text.fr + text.en), `${key} names a quarter`);
  }
});

// The reported/not-reported selector is not the question it governs.
test("the response-status selector carries no definition", () => {
  for (const id of ["S3Q01_RESPONSE_STATUS", "S3Q02_RESPONSE_STATUS", "S22Q01_RESPONSE_STATUS"]) {
    assert.equal(getModernJobsTooltip(id, "enterprise"), null, id);
  }
});

test("the respondent's function is defined in the words of their own body", () => {
  const generic = getModernJobsTooltip("S0Q02", "enterprise")!;
  const project = getModernJobsTooltip("S0Q02", "projectProgram")!;
  assert.match(generic.fr, /au sein de la structure/);
  assert.match(project.fr, /au sein du projet/);
  // An entity with no wording of its own keeps the generic one.
  assert.deepEqual(getModernJobsTooltip("S0Q02", "ctd"), generic);
  assert.deepEqual(getModernJobsTooltip("S0Q02"), generic);
});

/**
 * The guard against the collision coming back: every key in the map must be
 * a real field id somewhere in the schema. A paper code (S1Q01 is one too,
 * on five forms) only passes because it is also the enterprise's own id.
 */
test("every definition is keyed on a field that exists", () => {
  const schema = loadOnefopSchema();
  const fieldIds = new Set<string>();
  for (const entity of Object.values(schema.entities)) {
    for (const section of entity.sections) {
      for (const field of section.fields) fieldIds.add(field.id.toUpperCase());
    }
  }
  for (const key of Object.keys(MODERN_JOBS_TOOLTIPS)) {
    assert.ok(fieldIds.has(key), `${key} is not a field id — a concept belongs in CONCEPT_DEFINITIONS`);
  }
});
