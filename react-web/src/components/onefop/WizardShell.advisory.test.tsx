import { act, renderWithProviders, screen, within } from "@/test/render";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { schemaEntity, schemaField } from "@/test/schema";
import type { FormData, OnefopEntity, OnefopField, OnefopSection } from "@/lib/onefop-schema";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import { writeWizardPosition } from "@/lib/wizard-position";
import { VT_ADVISORY_DEBOUNCE_MS } from "@/hooks/useVtAdvisoryCoherence";

// The server's advisory 4.2/4.7, 4.2/4.8 and 4.7/4.10 flags, shown under the
// table while Section 4 is filled rather than only on the review screen.
// Advisory (CLAUDE.md §7): they never block Next.

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

function quiz(): FormData {
  const answers: Record<string, boolean> = {};
  for (const q of VT_QUIZ_QUESTIONS) answers[q.id] = true;
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

const AGE_FLAG = {
  code: "VT_TRAINEE_AGE_ENTRANT_MISMATCH",
  message:
    "Effectif total des apprenants par diplôme professionnel (4.2: 10, hommes) " +
    "ne correspond pas au total des entrants par tranche d'âge (4.7 entrants: 8, hommes).",
};
// A same-population rule: the wizard blocks on it itself, so it is not said again in amber.
const BLOCKING_FLAG = {
  code: "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH",
  message: "Effectif total des apprenants par diplôme académique (4.1: 12, hommes) ne correspond pas au total par diplôme professionnel (4.2: 10, hommes).",
};

// The server, as far as these tests need it: coherence-preview answers with
// `answer`; anything else fails as in every component test.
const realFetch = globalThis.fetch;
let previewCalls = 0;
function serveCoherence(answer: () => Promise<unknown>) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith("/onefop/coherence-preview")) {
      previewCalls++;
      return answer().then((body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as Response);
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

beforeEach(() => {
  sessionStorage.clear();
  previewCalls = 0;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

function renderAt(data: FormData, stepIndex: number) {
  writeWizardPosition(KEY, { stage: "section", sectionIndex: S4, stepIndex });
  return renderWithProviders(<WizardShell entity={entity} data={data} onChange={() => {}} positionKey={KEY} />, {
    queryData: [[["onefop", "active-quarter"], { code: "2026-T1", isOpen: true }]],
  });
}

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const quietTime = () => wait(VT_ADVISORY_DEBOUNCE_MS + 100);
const next = () => screen.getByRole("button", { name: /Suivant|Passer à la Validation/ });
const currentTable = () => {
  const list = screen.getByText("Tableaux de cette section").closest("details") as HTMLElement;
  const current = within(list).getAllByRole("button").find((b) => b.getAttribute("aria-current") === "step");
  return current?.textContent?.match(/^\d+\.\d+/)?.[0] ?? null;
};
const advisoryNotice = () => document.querySelector("[data-vt-advisory-coherence]");
const complete = () => ({ ...quiz(), ...filled("VT4_1"), ...filled("VT4_2"), ...filled("VT4_7") });

test("4.7 complete: the 4.2/4.7 flag is shown under 4.7, amber, with a link to 4.2, and Next still goes on", async () => {
  serveCoherence(async () => ({ flags: [BLOCKING_FLAG, AGE_FLAG] }));
  const { user } = renderAt(complete(), STEP_4_7);
  assert.equal(currentTable(), "4.7");
  assert.equal(advisoryNotice(), null, "nothing before the quiet time");

  await quietTime();
  const notice = advisoryNotice() as HTMLElement;
  assert.ok(notice, "the notice is shown");
  assert.equal(previewCalls, 1);
  assert.equal(notice.getAttribute("role"), "status");
  assert.match(notice.textContent ?? "", /\(4\.2 : 10, hommes\).*\(4\.7 entrants : 8, hommes\)|4\.2.*10.*4\.7.*8/);
  assert.ok(within(notice).getByRole("button", { name: "Ouvrir le tableau 4.2" }));
  assert.doesNotMatch(notice.textContent ?? "", /4\.1/, "the blocking 4.1/4.2 rule is not repeated in amber");

  await user.click(next());
  await wait(20);
  assert.equal(currentTable(), "4.8", "the advisory flag does not stop Next");
});

test("the link opens table 4.2, where the same flag is shown with a link back to 4.7", async () => {
  serveCoherence(async () => ({ flags: [AGE_FLAG] }));
  const { user } = renderAt(complete(), STEP_4_7);
  await quietTime();
  await user.click(screen.getByRole("button", { name: "Ouvrir le tableau 4.2" }));
  await wait(20);
  assert.equal(currentTable(), "4.2");
  assert.ok(within(advisoryNotice() as HTMLElement).getByRole("button", { name: "Ouvrir le tableau 4.7" }));
  assert.equal(previewCalls, 1, "moving between tables does not ask again for the same answers");
});

test("a failed check shows nothing and blocks nothing", async () => {
  serveCoherence(async () => {
    throw new Error("offline");
  });
  const { user } = renderAt(complete(), STEP_4_7);
  await quietTime();
  assert.equal(previewCalls, 1);
  assert.equal(advisoryNotice(), null);
  await user.click(next());
  await wait(20);
  assert.equal(currentTable(), "4.8");
});

test("no flag: no notice", async () => {
  serveCoherence(async () => ({ flags: [] }));
  renderAt(complete(), STEP_4_7);
  await quietTime();
  assert.equal(previewCalls, 1);
  assert.equal(advisoryNotice(), null);
});

test("nothing is asked while a compared pair is incomplete", async () => {
  serveCoherence(async () => ({ flags: [AGE_FLAG] }));
  renderAt({ ...quiz(), ...filled("VT4_1"), ...filled("VT4_2") }, STEP_4_7);
  await quietTime();
  assert.equal(previewCalls, 0);
  assert.equal(advisoryNotice(), null);
});

test("figures typed in quick succession are checked once, and the old flags hide as soon as a figure changes", async () => {
  serveCoherence(async () => ({ flags: [AGE_FLAG] }));
  const data = complete();
  const { rerender } = renderAt(data, STEP_4_7);
  await quietTime();
  assert.ok(advisoryNotice());
  assert.equal(previewCalls, 1);

  const cell = Object.keys(filled("VT4_7"))[0];
  for (const value of [1, 12, 123]) {
    rerender(<WizardShell entity={entity} data={{ ...data, [cell]: value }} onChange={() => {}} positionKey={KEY} />);
    assert.equal(advisoryNotice(), null, "flags of the old figures are hidden");
    await wait(50);
  }
  assert.equal(previewCalls, 1, "no request per keystroke");
  await quietTime();
  assert.equal(previewCalls, 2);
  assert.ok(advisoryNotice());
});
