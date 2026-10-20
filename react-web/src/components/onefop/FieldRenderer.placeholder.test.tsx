import { renderWithProviders } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity, schemaField } from "@/test/schema";
import { FieldRenderer } from "./FieldRenderer";

/**
 * Section 0's examples were the enterprise's on every form. The project had
 * its own pair; the administration, the NGO, the cooperative and the CTD each
 * got a label of their own — « Fonction / Titre dans la collectivité » — and
 * then « ex. Directeur des Ressources Humaines » underneath it. A commune has
 * no DRH, and no commune writes to contact@entreprise.com.
 */
function placeholderOf(entityName: string, fieldId: string): string {
  const entity = schemaEntity(entityName);
  const field = schemaField(entityName, fieldId);
  const section = entity.sections.find((s) => s.fields.some((f) => f.id === fieldId))!;
  const { container, unmount } = renderWithProviders(
    <FieldRenderer
      field={field}
      value={undefined}
      data={{}}
      onChange={() => {}}
      sectionId={section.id}
      entityType={entity.entityType}
    />,
  );
  const input = container.querySelector("input, textarea");
  const placeholder = input?.getAttribute("placeholder") ?? "";
  unmount();
  return placeholder;
}

test("Section 0's examples are the respondent's own form, not the enterprise's", () => {
  const jobTitles = new Map([
    ["projectProgram", "Coordonnateur"],
    ["administration", "Chef de service"],
    ["ong", "Directeur exécutif"],
    ["cooperative", "Gérant"],
    ["ctd", "Secrétaire général"],
  ]);

  for (const [entity, expected] of jobTitles) {
    const shown = placeholderOf(entity, "S0Q02");
    assert.ok(shown.includes(expected), `${entity} S0Q02: ${shown}`);
    assert.ok(!/Ressources Humaines/i.test(shown), `${entity} is still shown the enterprise's DRH: ${shown}`);
  }

  // The enterprise's own wording is correct for the enterprise.
  assert.match(placeholderOf("enterprise", "S0Q02"), /Directeur des Ressources Humaines/);
});

test("Section 0's e-mail example is the respondent's own form", () => {
  const domains = new Map([
    ["projectProgram", "projet.cm"],
    ["administration", "administration.cm"],
    ["ong", "ong.cm"],
    ["cooperative", "cooperative.cm"],
    ["ctd", "commune.cm"],
  ]);

  for (const [entity, domain] of domains) {
    const shown = placeholderOf(entity, "S0Q03_EMAIL");
    assert.ok(shown.includes(domain), `${entity} S0Q03_EMAIL: ${shown}`);
    assert.ok(!/entreprise\.com/.test(shown), `${entity} is still shown contact@entreprise.com: ${shown}`);
  }

  assert.match(placeholderOf("enterprise", "S0Q03_EMAIL"), /contact@entreprise\.com/);
});
