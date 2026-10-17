import { renderWithProviders, within } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { schemaEntity, schemaField } from "@/test/schema";
import type { OnefopEntity } from "@/lib/onefop-schema";
import { writeWizardPosition } from "@/lib/wizard-position";

// Defect 3: on the review step the side list lost "Preliminary
// questionnaire"; every other step lists it.

const vt = schemaEntity("vocationalTraining");
const optional = schemaField("vocationalTraining", "VT1_3");
const entity: OnefopEntity = {
  ...vt,
  sections: vt.sections.slice(0, 2).map((s) => ({ ...s, fields: [optional], subsections: [] })),
};
const KEY = "review-sidebar-test";

afterEach(() => sessionStorage.clear());

test("the review step's side list still names the preliminary questionnaire", () => {
  writeWizardPosition(KEY, { stage: "review", sectionIndex: 0 });
  renderWithProviders(<WizardShell entity={entity} data={{}} onChange={() => {}} positionKey={KEY} />, {
    locale: "en",
    queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]],
  });
  const nav = document.querySelector("nav") as HTMLElement;
  assert.ok(nav, "the side list is shown on a wide screen");
  assert.ok(within(nav).getByText("Preliminary questionnaire"));
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
