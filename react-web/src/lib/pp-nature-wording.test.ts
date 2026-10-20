import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopSchema } from "./onefop-schema";
import { ppFieldLabel, ppIdentificationTitle, ppNatureKind } from "./pp-nature-wording";
import { PROJECT_NATURE_OPTIONS } from "./register-options";
import { sectionNavTitle } from "./onefop-section-title";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;
const nature = schema.entities.projectProgram.sections
  .flatMap((s) => s.fields)
  .find((f) => f.id === "PP_S1Q01")!;
const [PROJECT, PROGRAMME, STRUCTURE, OTHER] = (nature.options ?? []).map((o) => o.value);

// The wording keys off PP_S1Q01's stored strings; if the AST renamed one, the
// wording would quietly fall back to the generic phrase.
test("registration and the wording read the questionnaire's own option strings", () => {
  assert.deepEqual(
    PROJECT_NATURE_OPTIONS.map((o) => o.value),
    (nature.options ?? []).map((o) => o.value),
  );
  assert.equal(ppNatureKind(PROJECT), "project");
  assert.equal(ppNatureKind(PROGRAMME), "programme");
  assert.equal(ppNatureKind(STRUCTURE), "structure");
  assert.equal(ppNatureKind(OTHER), "generic");
  assert.equal(ppNatureKind(undefined), "generic");
});

test("Sections 0 and 1 name the body the respondent said they answer for", () => {
  assert.equal(ppFieldLabel("PP_S1Q02", "project", "fr"), "Nom du projet");
  assert.equal(ppFieldLabel("PP_S1Q02", "programme", "fr"), "Nom du programme");
  assert.equal(ppFieldLabel("PP_S1Q02", "structure", "fr"), "Nom de la structure");
  assert.equal(ppFieldLabel("PP_S1Q02", "generic", "fr"), "Nom du projet ou du programme");
  assert.equal(ppFieldLabel("PP_S1Q13", "programme", "fr"), "Situation du programme");
  assert.equal(ppFieldLabel("S0Q02", "structure", "fr"), "Fonction / Titre dans la structure");
  assert.equal(ppFieldLabel("PP_S1Q02", "programme", "en"), "Name of the programme");
  // A question that does not name the body keeps the AST's label.
  assert.equal(ppFieldLabel("PP_S1Q03", "programme", "fr"), null);

  assert.equal(ppIdentificationTitle("project", "fr"), "Identification du projet");
  assert.equal(ppIdentificationTitle("structure", "fr"), "Identification de la structure");
});

test("the rail follows the answer too", () => {
  const raw = "SECTION 1. IDENTIFICATION DE LA STRUCTURE";
  assert.equal(
    sectionNavTitle("section1_projectProgram", raw, 1, "fr", { PP_S1Q01: PROGRAMME }),
    "Identification du programme",
  );
  assert.equal(
    sectionNavTitle("section2_projectProgram", "", 2, "fr", { PP_S1Q01: STRUCTURE }),
    "Renseignements sur la structure",
  );
  assert.equal(sectionNavTitle("section2_projectProgram", "", 2, "fr"), "Renseignements sur le projet");
});
