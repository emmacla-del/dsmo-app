import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopSchema } from "@/lib/onefop-schema";
import { formatSectionTitle, sectionNavTitle, sectionTitleWithoutNumber } from "@/lib/onefop-section-title";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

const title = (entity: string, sectionId: string, locale: "fr" | "en") => {
  const section = schema.entities[entity].sections.find((s) => s.id === sectionId);
  assert.ok(section, `${entity}/${sectionId} exists`);
  return section.title?.[locale] ?? "";
};

test("the AST's capitals are quietened and its 'SECTION N.' is not repeated", () => {
  assert.equal(
    formatSectionTitle("SECTION 2. EMPLOI ET TRAVAIL", 2),
    "Section 2. Emploi et travail",
  );
  assert.equal(sectionTitleWithoutNumber("SECTION 3. DÉPARTS", 3), "Départs");
});

// The rail named each project section with a paragraph, because the AST
// titles repeat « de la structure sous-tutelle / projet / programme ».
test("the project form's long sections have a short name in the rail", () => {
  const short = (id: string, locale: "fr" | "en") =>
    sectionNavTitle(id, title("projectProgram", id, locale), Number(/section(\d+)/.exec(id)![1]), locale);

  assert.equal(short("section2_projectProgram", "fr"), "Renseignements sur le projet");
  assert.equal(short("section3_projectProgram", "fr"), "Emploi et travail");
  assert.equal(short("section4_projectProgram", "fr"), "Recensements et recrutements");
  assert.equal(short("section4_projectProgram", "en"), "Headcount and recruitment");

  // Short enough to sit on one line of the rail, as the other five forms do.
  for (const id of ["section2_projectProgram", "section3_projectProgram", "section4_projectProgram"]) {
    assert.ok(short(id, "fr").length <= 32, `${id} is still a paragraph`);
  }
});

// Only those three, and Section 1, which names the body PP_S1Q01 says it is
// (pp-nature-wording.test.ts). Every other section keeps the questionnaire's
// own title, so nothing is renamed that the paper form names briefly already.
test("every other section still carries the title the AST gives it", () => {
  for (const [entity, body] of Object.entries(schema.entities)) {
    for (const [index, section] of body.sections.entries()) {
      if (section.id.endsWith("_projectProgram") && /section[1234]/.test(section.id)) continue;
      const raw = title(entity, section.id, "fr");
      assert.equal(
        sectionNavTitle(section.id, raw, index, "fr"),
        sectionTitleWithoutNumber(raw, index),
        `${entity}/${section.id} was renamed`,
      );
    }
  }
});

// The section screen keeps the official wording in full: the rail's short
// name is for finding your way, not for answering under a different title.
test("the full title still heads the section itself", () => {
  const raw = title("projectProgram", "section4_projectProgram", "fr");
  assert.match(formatSectionTitle(raw, 4), /^Section 4\. Details sur les resencements et recrutements/);
  assert.ok(formatSectionTitle(raw, 4).includes("structure sous-tutelle"));
});
