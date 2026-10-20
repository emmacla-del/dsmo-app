import { renderWithProviders, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import { SectionRenderer } from "@/components/onefop/SectionRenderer";
import { cardDescriptionKey, cardTitleKey, classifySection1Field } from "./Section1ThematicRenderer";

function renderSection1(entityName: string) {
  const entity = schemaEntity(entityName);
  // The ids are not uniformly the entity name — the enterprise's is
  // "section1_entreprise", in French.
  const section =
    entity.sections.find((s) => s.id === `section1_${entityName}`) ??
    entity.sections.find((s) => s.id.startsWith("section1"))!;
  const result = renderWithProviders(
    <SectionRenderer section={section} data={{}} onChange={() => {}} entityType={entity.entityType} />,
  );
  return { ...result, q: within(result.container) };
}

// « Siège social » is an address. It fell to the identity card because the
// classifier lists nothing for it and identity is the default, so it sat
// between the acronym and the supervising ministry while every other address
// question was a card lower.
test("a project's head office is asked with the other address questions", () => {
  assert.equal(classifySection1Field("PP_S1Q11"), "location");
  // The employer forms' own S1Q11 is a different question and stays put.
  assert.equal(classifySection1Field("S1Q11"), "activity");
});

// The card descriptions were the enterprise's, on every form: a project was
// told its identity card held a « statut juridique » and an « immatriculation »,
// neither of which it is asked for anywhere.
test("a card describes what this form asks in it", () => {
  assert.equal(cardDescriptionKey("identity", "projectProgram"), "cards.identity.description_projectProgram");
  assert.equal(cardDescriptionKey("identity", "enterprise"), "cards.identity.description");
  assert.equal(cardDescriptionKey("contact", "projectProgram"), "cards.contact.description");

  const { container, unmount } = renderSection1("projectProgram");
  const text = (container.textContent ?? "").replace(/\s+/g, " ");
  assert.ok(!/immatriculation|statut juridique/i.test(text), "the enterprise wording is still shown to a project");
  unmount();

  const enterprise = renderSection1("enterprise");
  const enterpriseText = (enterprise.container.textContent ?? "").replace(/\s+/g, " ");
  assert.match(enterpriseText, /Dénomination officielle, statut juridique/);
  enterprise.unmount();
});

// The description was given a project wording and the title was missed, so the
// card stayed headed « Identité légale » over content holding no legal identity.
test("a card is headed by what this form asks in it", () => {
  assert.equal(cardTitleKey("identity", "projectProgram"), "cards.identity.title_projectProgram");
  assert.equal(cardTitleKey("identity", "enterprise"), "cards.identity.title");
  assert.equal(cardTitleKey("location", "projectProgram"), "cards.location.title");

  const { container, unmount } = renderSection1("projectProgram");
  const headings = [...container.querySelectorAll("h2")].map((h) => (h.textContent ?? "").trim());
  assert.ok(!headings.includes("Identité légale"), headings.join(" | "));
  unmount();

  // The employer forms keep it: an enterprise does have a legal identity.
  const enterprise = renderSection1("enterprise");
  const employerHeadings = [...enterprise.container.querySelectorAll("h2")].map((h) => (h.textContent ?? "").trim());
  assert.ok(employerHeadings.includes("Identité légale"), employerHeadings.join(" | "));
  enterprise.unmount();
});

// 1.1–1.4 were this app's own numbering for four cards, in the notation the
// form uses for its real questions (4.1–4.6 in Section 4).
test("the cards carry no number of their own", () => {
  const { container, unmount } = renderSection1("projectProgram");
  const headings = [...container.querySelectorAll("h2")].map((h) => (h.textContent ?? "").trim());
  assert.ok(headings.includes("Localisation administrative"), headings.join(" | "));
  assert.ok(!headings.some((h) => /^\d+\.\d+/.test(h)), headings.join(" | "));
  unmount();
});

test("PP Section 1 does not re-ask entity designation (PP_S1Q01) already chosen at registration", () => {
  const { container, unmount } = renderSection1("projectProgram");
  const text = (container.textContent ?? "").replace(/\s+/g, " ");
  assert.ok(!text.includes("Type d'entité"), "« Type d'entité » should not be re-asked in Section 1");
  unmount();
});

test("PP Section 1 omits duplicate identity card heading and status chip under Section 1 title", () => {
  const { container, unmount } = renderSection1("projectProgram");
  const headings = [...container.querySelectorAll("h2")].map((h) => (h.textContent ?? "").trim());
  assert.ok(!headings.includes("Identification et tutelle"), "duplicate heading should not appear");
  const text = (container.textContent ?? "").replace(/\s+/g, " ");
  assert.ok(!text.includes("Nom, sigle, responsable et ministère"), "description should not appear");
  unmount();
});
