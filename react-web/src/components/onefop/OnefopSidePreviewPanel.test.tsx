// Imported first: it installs jsdom before Testing Library loads.
import { renderWithProviders, waitFor } from "@/test/render";
import { act } from "@testing-library/react";
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { OnefopSidePreviewPanel } from "./OnefopSidePreviewPanel";

// What the refreshed document does with its scroll offset is not covered
// here: jsdom never loads the blob: frame, so there is no contentWindow to
// read a position from or put one back on.

const rejectingFetch = globalThis.fetch;
let calls = 0;

/** Counts the preview requests and answers each with a minimal document. */
function stubPreviewFetch() {
  calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("<!doctype html><html><body>Aperçu</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }) as typeof fetch;
}

// jsdom implements neither of these.
const objectUrl = URL.createObjectURL;
const revokeObjectUrl = URL.revokeObjectURL;
URL.createObjectURL = () => "blob:preview";
URL.revokeObjectURL = () => {};

afterEach(() => {
  globalThis.fetch = rejectingFetch;
});

process.on("exit", () => {
  URL.createObjectURL = objectUrl;
  URL.revokeObjectURL = revokeObjectUrl;
});

/** Lets the refresh's idle timer and its request run to completion. */
const settle = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

function panel(data: Record<string, unknown>) {
  return (
    <OnefopSidePreviewPanel
      isOpen
      onClose={() => {}}
      onExpandModal={() => {}}
      entityType="vocationalTraining"
      data={data}
      quarterCode="QUARTERLY_2026_T4_001"
      locale="fr"
      entity={null}
      establishmentName="Waltz"
    />
  );
}

test("opening the side preview requests the declaration once", async () => {
  stubPreviewFetch();
  renderWithProviders(panel({}));
  await settle(1200);
  assert.equal(calls, 1);
});

test("a refresh waits for the respondent to leave the field", async () => {
  stubPreviewFetch();
  const field = document.createElement("input");
  field.type = "text";
  document.body.appendChild(field);

  const { rerender } = renderWithProviders(panel({ VT1_1: "a" }));
  await settle(1200);
  assert.equal(calls, 1);

  field.focus();
  rerender(panel({ VT1_1: "ab" }));
  await settle(1200);
  assert.equal(calls, 1, "the preview must not reload under a field being typed in");

  field.blur();
  await waitFor(() => assert.equal(calls, 2), { timeout: 3000 });
  field.remove();
});

test("a committed value refreshes without waiting for a blur", async () => {
  stubPreviewFetch();
  const box = document.createElement("input");
  box.type = "checkbox";
  document.body.appendChild(box);

  const { rerender } = renderWithProviders(panel({ VT2_1: false }));
  await settle(1200);
  assert.equal(calls, 1);

  box.focus();
  rerender(panel({ VT2_1: true }));
  await waitFor(() => assert.equal(calls, 2), { timeout: 3000 });
  box.remove();
});
