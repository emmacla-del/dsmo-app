import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity, schemaField } from "@/test/schema";
import { FieldRenderer } from "./FieldRenderer";

/**
 * On screen, not just in the registry: FieldRenderer fell back to the paper
 * code when a field id had no definition, and every form numbers its
 * Section 1 questions S1Q01, S1Q10, S1Q11. So « Nature de la structure »
 * was explained as a « régime juridique… déclaré au registre de commerce »,
 * « Objectif ou mission principale » as an « effectif total des salariés »,
 * and the CTD's « Nombre de poste vacant » as the headcount.
 */
function renderField(entityName: string, fieldId: string) {
  const entity = schemaEntity(entityName);
  const field = schemaField(entityName, fieldId);
  const section = entity.sections.find((s) => s.fields.some((f) => f.id === fieldId))!;
  return renderWithProviders(
    <FieldRenderer
      field={field}
      value={undefined}
      data={{}}
      onChange={() => {}}
      sectionId={section.id}
      entityType={entity.entityType}
    />,
  );
}

/** The ⓘ button a question shows when it has a definition, or null. Found
 *  by aria-expanded, since its accessible name is the question's own label
 *  on most field types and "Informations complémentaires" on a radio. */
function infoButton(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>("button[aria-expanded]");
}

const NO_DEFINITION = [
  ["projectProgram", "PP_S1Q01", "Nature de la structure"],
  ["projectProgram", "PP_S1Q10", "Objectif ou mission principale"],
  ["projectProgram", "PP_S1Q11", "Siège social"],
  ["cooperative", "COOP_S1Q01", "Nom de la coopérative"],
  ["ctd", "CTD_S1Q01", "Type de CTD"],
  ["ong", "ONG_S1Q01", "Nom de l'ONG"],
  ["administration", "ADMIN_S1Q10", "Combien de projets ?"],
] as const;

test("a question the paper code used to explain now shows no ⓘ", () => {
  for (const [entityName, fieldId, question] of NO_DEFINITION) {
    const { container, unmount } = renderField(entityName, fieldId);
    assert.equal(infoButton(container), null, `${fieldId} (${question}) still shows a definition`);
    unmount();
  }
});

test("a staffing question explains the count it actually asks for", async () => {
  // « Nombre de poste vacant », which used to be explained as the headcount.
  const { container, user, unmount } = renderField("ctd", "CTD_S1Q10");
  const button = infoButton(container);
  assert.ok(button, "CTD_S1Q10 shows no definition at all");
  await user.click(button);
  const text = screen.getByRole("tooltip").textContent ?? "";
  assert.match(text, /postes ouverts et non pourvus/);
  assert.ok(!/Effectif total/.test(text), text);
  unmount();
});

test("the project's permanent headcount is explained, and names no quarter", async () => {
  const { container, user, unmount } = renderField("projectProgram", "PP_S1Q15");
  const button = infoButton(container);
  assert.ok(button, "PP_S1Q15 shows no definition");
  await user.click(button);
  const text = screen.getByRole("tooltip").textContent ?? "";
  assert.match(text, /Effectif total des salariés sous contrat permanent/);
  assert.match(text, /période de référence/);
  unmount();
});

test("the respondent's function is explained in the words of their own body", async () => {
  const project = renderField("projectProgram", "S0Q02");
  await project.user.click(infoButton(project.container)!);
  assert.match(screen.getByRole("tooltip").textContent ?? "", /au sein du projet/);
  project.unmount();

  const council = renderField("ctd", "S0Q02");
  await council.user.click(infoButton(council.container)!);
  assert.match(screen.getByRole("tooltip").textContent ?? "", /au sein de la structure/);
  council.unmount();
});
