import { renderWithProviders, screen } from "@/test/render";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { schemaEntity } from "@/test/schema";
import type { FormData, OnefopEntity, OnefopSection } from "@/lib/onefop-schema";
import { ENTRY_MODE_STORAGE_KEY } from "@/lib/use-entry-mode";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import { writeWizardPosition } from "@/lib/wizard-position";

// A phone is Guidé and nothing else (owner, 2026-10-20): no grid of cells
// is drawn there, in either wizard, whatever this browser last chose on a
// wider screen — and no switch offers one.

const realMatchMedia = window.matchMedia;
function phoneViewport() {
  window.matchMedia = ((query: string) =>
    ({ ...realMatchMedia(query), matches: query.includes("max-width: 767px") })) as typeof window.matchMedia;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
  localStorage.clear();
});

const KEY = "phone-test";
const optional = (f: { id: string }) => ({ ...f, required: false } as never);

/** The section under test, behind one section nothing can fail in. */
function framed(entityName: string, sectionId: string): OnefopEntity {
  const entity = schemaEntity(entityName);
  const section = entity.sections.find((s) => s.id === sectionId)!;
  const first = entity.sections[0];
  const filler: OnefopSection = {
    ...first,
    fields: [optional(first.fields[0])],
    subsections: [],
  };
  return { ...entity, sections: [filler, section] };
}

function render(entity: OnefopEntity, data: FormData) {
  writeWizardPosition(KEY, { stage: "section", sectionIndex: 1 });
  return renderWithProviders(<WizardShell entity={entity} data={data} onChange={() => {}} positionKey={KEY} />, {
    queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]],
  });
}

const reported = (codes: string[]) => Object.fromEntries(codes.map((c) => [`${c}_RESPONSE_STATUS`, "REPORTED"]));

test("the project wizard draws no grid on a phone, and offers no switch", () => {
  phoneViewport();
  // Even with Tableau remembered from a wider screen.
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, "grid");
  render(
    framed("projectProgram", "section4_projectProgram"),
    reported(["S4Q01", "S4Q02", "S4Q03", "S4Q04", "S4Q05", "S4Q06"]),
  );

  assert.equal(document.querySelectorAll("table").length, 0, "a statistical grid is on a phone screen");
  assert.equal(screen.queryByRole("group", { name: /saisie|entry/i }), null, "the Tableau / Guidé switch is offered");
});

test("the training-centre wizard draws no grid on a phone", () => {
  phoneViewport();
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, "grid");
  const answers: Record<string, boolean> = {};
  for (const q of VT_QUIZ_QUESTIONS) answers[q.id] = true;
  render(framed("vocationalTraining", "section4_vocationalTraining"), {
    _scopeConfig: { vocationalTraining: answers },
    VT2_18: ["Formation Initiale (FI)"],
  });

  assert.equal(document.querySelectorAll("table").length, 0, "a statistical grid is on a phone screen");
});

test("the same wizard on a wider screen draws its grids", () => {
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, "grid");
  render(
    framed("projectProgram", "section4_projectProgram"),
    reported(["S4Q01", "S4Q02", "S4Q03", "S4Q04", "S4Q05", "S4Q06"]),
  );

  assert.ok(document.querySelectorAll("table").length > 0, "Tableau draws no grid on a wide screen");
});
