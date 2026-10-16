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
