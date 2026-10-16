import { act, renderWithProviders, screen, within } from "@/test/render";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { schemaEntity, schemaField } from "@/test/schema";
import type { FormData, OnefopEntity, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import { writeWizardPosition } from "@/lib/wizard-position";

// The advisory 4.2/4.7, 4.2/4.8 and 4.7/4.10 disagreements, shown under the
// table the moment both tables of a pair are complete, while Section 4 is
// filled rather than only on the review screen. Advisory (CLAUDE.md §7):
// they never block Next.

const vt = schemaEntity("vocationalTraining");
const s4 = vt.sections.find((s) => s.id === "section4_vocationalTraining")!;
const optional = schemaField("vocationalTraining", "VT1_3");
const filler = (id: string, base: OnefopSection): OnefopSection => ({ ...base, id, fields: [optional], subsections: [] });
const entity: OnefopEntity = {
  ...vt,
  sections: [filler(vt.sections[0].id, vt.sections[0]), filler("test_before", vt.sections[1]), s4, filler("test_after", vt.sections[4])],
};
const S4 = 2;
const STEP_4_7 = 6;
const KEY = "advisory-test";

function quiz(overrides: Record<string, boolean> = {}): FormData {
  const answers: Record<string, boolean> = {};
  for (const q of VT_QUIZ_QUESTIONS) answers[q.id] = true;
  Object.assign(answers, overrides);
  return { _scopeConfig: { vocationalTraining: answers }, VT2_18: ["Formation Initiale (FI)"] };
}

/** A complete table of zeros: every row of a fixed-row table, the first of a row-by-row one. */
function filled(fieldId: string): FormData {
  const field = s4.fields.find((f) => f.id === fieldId) as OnefopField;
  const vtTable = field.table!.vt!;
  const rows = vtTable.progressiveRows ? field.table!.matrix!.slice(0, 1) : field.table!.matrix!;
  const out: FormData = {};
  for (const rowIds of rows) {
    rowIds.forEach((cellId, c) => {
      const kind = vtTable.cells[c]?.kind;
      if (kind === "number") out[cellId] = 0;
      else if (kind === "text") out[cellId] = "Test";
    });
  }
  return out;
}

// Count any request to the server's preview: the table screens no longer ask it.
const realFetch = globalThis.fetch;
let previewCalls = 0;
beforeEach(() => {
  sessionStorage.clear();
  previewCalls = 0;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("coherence-preview")) previewCalls++;
    return realFetch(input, init);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

function shell(data: FormData) {
  return <WizardShell entity={entity} data={data} onChange={() => {}} positionKey={KEY} />;
}
function renderAt(data: FormData, stepIndex: number) {
  writeWizardPosition(KEY, { stage: "section", sectionIndex: S4, stepIndex });
  return renderWithProviders(shell(data), {
    queryData: [[["onefop", "active-quarter"], { code: "2026-T1", isOpen: true }]],
  });
}

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const next = () => screen.getByRole("button", { name: /Suivant|Passer à la Validation/ });
const currentTable = () => {
  const list = screen.getByText("Tableaux de cette section").closest("details") as HTMLElement;
  const current = within(list).getAllByRole("button").find((b) => b.getAttribute("aria-current") === "step");
  return current?.textContent?.match(/^\d+\.\d+/)?.[0] ?? null;
};
const advisoryNotice = () => document.querySelector("[data-vt-advisory-coherence]") as HTMLElement | null;
/** 4.1, 4.2 and 4.7 complete; 4.2 counts 10 men, 4.7 counts 8 entering men. */
const mismatched = (): FormData => ({
  ...quiz(),
  ...filled("VT4_1"),
  ...filled("VT4_2"),
  ...filled("VT4_7"),
  s4q1_cap_male: 10,
  s4q2_cap_male: 10,
  s4q7_age_18_entrant_male: 8,
});

test("4.7 complete and off from 4.2: the line is there at once, amber, with a link to 4.2, and Next still goes on", async () => {
  const { user } = renderAt(mismatched(), STEP_4_7);
  assert.equal(currentTable(), "4.7");
  const notice = advisoryNotice();
  assert.ok(notice, "shown on the first render, with no wait");
  assert.equal(notice.getAttribute("role"), "status");
  assert.match(notice.textContent ?? "", /Entrées incohérentes : hommes : 4\.2 = 10, 4\.7 entrants = 8/);
  assert.ok(within(notice).getByRole("button", { name: "Ouvrir le tableau 4.2" }));
  assert.equal(screen.queryByRole("alert"), null, "nothing red");

  await user.click(next());
  await wait(20);
  assert.equal(currentTable(), "4.8", "the advisory line does not stop Next");
  assert.equal(previewCalls, 0, "no server request while the tables are filled");
});

test("the link opens table 4.2, where the same line points back to 4.7", async () => {
  const { user } = renderAt(mismatched(), STEP_4_7);
  await user.click(screen.getByRole("button", { name: "Ouvrir le tableau 4.2" }));
  await wait(20);
  assert.equal(currentTable(), "4.2");
  assert.ok(within(advisoryNotice()!).getByRole("button", { name: "Ouvrir le tableau 4.7" }));
});

test("the line follows the figures as they are typed", () => {
  const data = mismatched();
  const { rerender } = renderAt(data, STEP_4_7);
  assert.ok(advisoryNotice());
  rerender(shell({ ...data, s4q7_age_19_entrant_male: 2 }));
  assert.equal(advisoryNotice(), null, "8 + 2 = 10: gone as soon as the totals agree");
  rerender(shell({ ...data, s4q7_age_19_entrant_male: 3 }));
  assert.match(advisoryNotice()?.textContent ?? "", /4\.7 entrants = 11/);
});

test("nothing while a compared table is incomplete, or when the totals agree", () => {
  const { unmount } = renderAt({ ...quiz(), ...filled("VT4_1"), ...filled("VT4_2"), s4q1_cap_male: 10, s4q2_cap_male: 10 }, STEP_4_7);
  assert.equal(advisoryNotice(), null);
  unmount();
  renderAt({ ...quiz(), ...filled("VT4_1"), ...filled("VT4_2"), ...filled("VT4_7") }, STEP_4_7);
  assert.equal(advisoryNotice(), null);
});

test("a table the rules do not compare shows nothing", () => {
  renderAt(mismatched(), 0);
  assert.equal(currentTable(), "4.1");
  assert.equal(advisoryNotice(), null);
});

test("4.10 switched off by the questionnaire: 4.7 leavers are compared with 0, and the line offers the questionnaire", async () => {
  const data = { ...quiz({ formerStudents: false }), ...filled("VT4_1"), ...filled("VT4_2"), ...filled("VT4_7"), s4q7_age_18_sortant_male: 3 };
  const { user } = renderAt(data, STEP_4_7);
  const notice = advisoryNotice();
  assert.ok(notice, "shown on 4.7 although 4.10 is never filled");
  assert.match(notice.textContent ?? "", /4\.7 sortants = 3, 4\.10 \(sans objet\) = 0/);
  await user.click(within(notice).getByRole("button", { name: "Revoir le questionnaire préliminaire" }));
  await wait(20);
  assert.ok(document.getElementById("vt-quiz-heading"), "the questionnaire is open");
});
