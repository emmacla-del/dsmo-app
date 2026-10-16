import { act, createTestQueryClient, renderWithProviders, screen } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { WizardShell } from "./WizardShell";
import { schemaEntity, schemaField } from "@/test/schema";
import type { OnefopEntity } from "@/lib/onefop-schema";
import { VT_QUIZ_QUESTIONS } from "@/lib/vt-quiz";
import { writeWizardPosition } from "@/lib/wizard-position";

// Defect 2 of the 2026-10-15 VT run: the receipt showed inside the review
// window, under "Official review before final submission", with its "Edit
// information" button. A successful submission now closes the window and the
// receipt is on the page.

const vt = schemaEntity("vocationalTraining");
const optional = schemaField("vocationalTraining", "VT1_3");
const entity: OnefopEntity = {
  ...vt,
  sections: vt.sections.slice(0, 2).map((s) => ({ ...s, fields: [optional], subsections: [] })),
};
const KEY = "receipt-test";
const REF = "b1a1404c-cc71-4727-8407-710fed7d2259";

/**
 * The test client keeps queries forever but not mutations: React Query holds a
 * finished mutation for 5 minutes on a timer, which keeps the test process
 * alive after the submission. Kept forever here too, so there is no timer.
 */
function clientWithoutMutationTimer() {
  const client = createTestQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: false, gcTime: Infinity } });
  return client;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  sessionStorage.clear();
});

test("a successful submission closes the review window and shows the receipt on the page", async () => {
  const submits: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/onefop/submit")) {
      submits.push(url);
      return new Response(JSON.stringify({ success: true, message: "Déclaration enregistrée", submissionId: REF }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error("offline");
  }) as typeof fetch;

  const answers: Record<string, boolean> = {};
  for (const q of VT_QUIZ_QUESTIONS) answers[q.id] = true;
  writeWizardPosition(KEY, { stage: "review", sectionIndex: 0 });
  const { user } = renderWithProviders(
    <WizardShell
      entity={entity}
      data={{ _scopeConfig: { vocationalTraining: answers }, VT1_3: "CFP" }}
      onChange={() => {}}
      positionKey={KEY}
    />,
    { locale: "en", queryClient: clientWithoutMutationTimer(), queryData: [[["onefop", "active-quarter"], { code: "QUARTERLY_2026_T4_001", isOpen: true }]] },
  );

  // The final screen's submit opens the review window, whose confirm submits.
  const openReview = screen.getAllByRole("button").find((b) => /submit/i.test(b.textContent ?? "") && !b.hasAttribute("disabled"));
  assert.ok(openReview, "a submit button on the final screen");
  await user.click(openReview!);
  assert.ok(screen.getByText("Official Review before Final Submission"));
  await user.click(screen.getByRole("button", { name: /Confirm & Submit/ }));
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  assert.equal(submits.length, 1);
  assert.equal(screen.queryByText("Official Review before Final Submission"), null, "the review window is closed");
  assert.equal(screen.queryByRole("button", { name: /Edit information/ }), null);
  assert.ok(screen.getByRole("heading", { name: "Declaration submitted" }));
  assert.ok(screen.getByText(REF));
  assert.ok(screen.getByText("Awaiting review by ONEFOP"));
});
