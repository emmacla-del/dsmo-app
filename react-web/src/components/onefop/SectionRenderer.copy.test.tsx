import { renderWithProviders } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import { SectionRenderer } from "./SectionRenderer";

// A section-by-section pass over the Project/Programme wizard, 2026-10-19.
// What a respondent reads: no heading said twice, nothing shouting, the
// questions in the order the form asks them, and the body they are
// answering for named correctly.

function render(entityName: string, sectionId: string, data: Record<string, unknown> = {}) {
  const entity = schemaEntity(entityName);
  const section = entity.sections.find((s) => s.id === sectionId)!;
  const result = renderWithProviders(
    <SectionRenderer section={section} data={data} onChange={() => {}} entityType={entity.entityType} />,
  );
  return { ...result, text: (result.container.textContent ?? "").replace(/\s+/g, " ") };
}

test("Section 0 says its name once, not twice", () => {
  const { container, text, unmount } = render("projectProgram", "section0");
  const heading = "Identification du répondant";
  const occurrences = text.split(heading).length - 1;
  assert.equal(occurrences, 1, `"${heading}" appears ${occurrences} times: ${text.slice(0, 220)}`);
  assert.equal(container.querySelectorAll("h1").length, 1);
  unmount();
});

test("Section 0 names the body the respondent answers for", () => {
  const project = render("projectProgram", "section0");
  assert.match(project.text, /pour le compte du projet ou du programme/);
  assert.ok(!/pour le compte de l’établissement/.test(project.text), project.text.slice(0, 200));
  project.unmount();

  // An entity with no wording of its own is unchanged.
  const enterprise = render("enterprise", "section0");
  assert.match(enterprise.text, /pour le compte de l’établissement/);
  enterprise.unmount();
});

test("the project e-mail example is a project address", () => {
  const { container, unmount } = render("projectProgram", "section0");
  const email = container.querySelector<HTMLInputElement>("#S0Q03_EMAIL");
  assert.equal(email?.placeholder, "ex. contact@projet.cm");
  unmount();

  const other = render("enterprise", "section0");
  assert.equal(
    other.container.querySelector<HTMLInputElement>("#S0Q03_EMAIL")?.placeholder,
    "ex. contact@entreprise.com",
  );
  other.unmount();
});

// The AST stores its section titles in capitals, as the paper prints them.
// The rail has always quietened them; the heading printed them as stored.
test("a section heading does not shout", () => {
  for (const [entity, sectionId, expected] of [
    ["projectProgram", "section4_projectProgram", /^Section 4\. Details sur les resencements/],
    ["projectProgram", "section1_projectProgram", /^Section 1\. Identification de la structure/],
    ["enterprise", "section2", /^Section 2\. Emploi et travail/],
  ] as const) {
    const { container, unmount } = render(entity, sectionId);
    const heading = container.querySelector("h1")?.textContent?.trim() ?? "";
    assert.match(heading, expected);
    assert.notEqual(heading, heading.toUpperCase(), `still shouting: ${heading}`);
    unmount();
  }
});

// Grouping Section 1 by control type put its first question last.
test("Section 1 asks its questions in the form's own order", () => {
  const { container, unmount } = render("projectProgram", "section1_projectProgram");
  const card = container.querySelector("h2")?.closest("div")?.parentElement;
  assert.ok(card, "no group card rendered");
  const text = (container.textContent ?? "").replace(/\s+/g, " ");
  const nature = text.indexOf("Nature de la structure");
  const name = text.indexOf("Sigle ou acronyme");
  assert.ok(nature > -1 && name > -1, "questions missing");
  assert.ok(nature < name, "« Nature de la structure » is still asked after the text boxes");
  unmount();
});

test("a group heading is a heading, in the page's own voice", () => {
  const { container, unmount } = render("projectProgram", "section1_projectProgram");
  const groupHeadings = [...container.querySelectorAll("h2")].map((h) => h.textContent?.trim() ?? "");
  // No invented number in front of it: "1.1" would read as a form number,
  // and the form's own numbers are 4.1–4.6 in Section 4.
  assert.ok(groupHeadings.includes("Identité légale"), groupHeadings.join(" | "));
  assert.ok(
    !groupHeadings.some((h) => /^\d+\.\d+\s/.test(h)),
    `a card is numbered like a form question: ${groupHeadings.join(" | ")}`,
  );
  for (const heading of groupHeadings) {
    assert.notEqual(heading, heading.toUpperCase(), `still shouting: ${heading}`);
  }
  unmount();
});
