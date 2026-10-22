import { renderWithProviders, within } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { schemaEntity, schemaField } from "@/test/schema";
import type { OnefopEntity } from "@/lib/onefop-schema";
import { writeWizardPosition } from "@/lib/wizard-position";

// Defect 3: on the review step the side list lost the preliminary quiz;
// every other step lists it. The rail names it "Preliminary quiz".

const vt = schemaEntity("vocationalTraining");
const optional = schemaField("vocationalTraining", "VT1_3");
const entity: OnefopEntity = {
  ...vt,
  sections: vt.sections.slice(0, 2).map((s) => ({ ...s, fields: [optional], subsections: [] })),
};
const KEY = "review-sidebar-test";

afterEach(() => sessionStorage.clear());

test("the review step's side list still names the preliminary quiz", () => {
  writeWizardPosition(KEY, { stage: "review", sectionIndex: 0 });
  renderWithProviders(<WizardShell entity={entity} data={{}} onChange={() => {}} positionKey={KEY} />, {
    locale: "en",
    queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]],
  });
  const nav = document.querySelector("nav") as HTMLElement;
  assert.ok(nav, "the side list is shown on a wide screen");
  assert.ok(within(nav).getByText("Preliminary quiz"));
});

// 2026-10-16 re-test: the side list and the Contents drawer still named the
// last step "Review and submission"; the page it opens is "Check your answers".
test("the side list names the last step as its page does", () => {
  writeWizardPosition(KEY, { stage: "section", sectionIndex: 0 });
  renderWithProviders(<WizardShell entity={entity} data={{}} onChange={() => {}} positionKey={KEY} />, {
    locale: "en",
    queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]],
  });
  const nav = document.querySelector("nav") as HTMLElement;
  assert.ok(within(nav).getByText("Check your answers"));
  assert.equal(within(nav).queryByText("Review and submission"), null);
});

// B8 (E2E 2026-10-17): on the employer review screen each section carried
// its index + 1, so « Employment and labour » was 3 there and 2 in the rail.
// Modern Jobs numbers its sections from 0, as the paper form does.

const pp = schemaEntity("projectProgram");
const ppOptional = schemaField("projectProgram", "PP_S1Q03");
const ppEntity: OnefopEntity = {
  ...pp,
  sections: pp.sections.map((s) => ({ ...s, fields: [ppOptional], subsections: [] })),
};

test("the review screen numbers a section as the rail does", () => {
  writeWizardPosition(KEY, { stage: "review", sectionIndex: 0 });
  renderWithProviders(<WizardShell entity={ppEntity} data={{}} onChange={() => {}} positionKey={KEY} />, {
    locale: "en",
    queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]],
  });

  const nav = document.querySelector("nav") as HTMLElement;
  assert.ok(nav, "the side list is shown on a wide screen");

  // Every section of the review list carries its own index, and that index
  // is the one the rail shows for the same section.
  const main = document.querySelector("main") as HTMLElement;
  const titles = ppEntity.sections.map((s) => (s.title?.en ?? s.title?.fr ?? s.id));
  assert.ok(titles.length >= 3, "the project questionnaire has several sections");

  const badges = [...main.querySelectorAll("span")]
    .map((el) => el.textContent?.trim() ?? "")
    .filter((txt) => /^\d+$/.test(txt));
  assert.ok(badges.includes("0"), `a section is numbered 0, saw ${badges.join(", ")}`);
  assert.ok(
    !badges.includes(String(ppEntity.sections.length)),
    `no section is numbered past the last index, saw ${badges.join(", ")}`,
  );
});

// C7 (E2E 2026-10-18): the employer review screen read « Edit » five times
// with no section, a sixth bare « Edit » that only reopened Section 0, the
// arrows as part of the button names, and « Review & Submit » on the review
// screen itself.

const en = schemaEntity("enterprise");
const enField = schemaField("enterprise", "S1Q03");
const enEntity: OnefopEntity = {
  ...en,
  sections: en.sections.map((s) => ({ ...s, fields: [enField], subsections: [] })),
};

test("C7. every button on the review screen says what it does, once", () => {
  writeWizardPosition(KEY, { stage: "review", sectionIndex: 0 });
  const { container, unmount } = renderWithProviders(
    <WizardShell entity={enEntity} data={{}} onChange={() => {}} positionKey={KEY} />,
    { locale: "en", queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]] },
  );
  const q = within(container);
  // One per section, each naming it.
  assert.ok(q.getByRole("button", { name: "Edit the Departures section" }));
  assert.ok(q.getByRole("button", { name: "Edit the Employment and labour section" }));
  assert.equal(q.queryAllByRole("button", { name: "Edit" }).length, 0, "an « Edit » that names nothing is back");
  // Nothing to correct, so no « Fix » either.
  assert.equal(q.queryAllByRole("button", { name: /^Fix/ }).length, 0);
  // The arrows are decoration, not part of the name.
  assert.ok(q.getByRole("button", { name: "Previous" }));
  assert.ok(q.getByRole("button", { name: "Submit the declaration" }));
  assert.equal(q.queryAllByRole("button", { name: /Review & Submit/ }).length, 0);
  unmount();
});
