import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api-client";
import { submitDeclaration } from "./onefop-submission";

function respondWith(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}

// The server answers a retry of the same formId with its original success, so
// a 409 always means a different declaration already exists for the quarter.
test("a 409 from /onefop/submit reaches the caller as an error, never as a success", async () => {
  const original = globalThis.fetch;
  try {
    respondWith(409, {
      statusCode: 409,
      message: "Une déclaration est déjà en cours pour ce trimestre. / A declaration already exists for this quarter.",
    });
    await assert.rejects(
      submitDeclaration("enterprise", "QUARTERLY_2026_T3", {}, false, null, "form-1"),
      (err: unknown) => err instanceof ApiError && err.status === 409,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("a successful submission returns the server's own reference", async () => {
  const original = globalThis.fetch;
  try {
    respondWith(201, { success: true, submissionId: "srv-42", message: "Formulaire soumis avec succès" });
    const result = await submitDeclaration("enterprise", "QUARTERLY_2026_T3", {}, false, null, "form-1");
    assert.equal(result.submissionId, "srv-42");
  } finally {
    globalThis.fetch = original;
  }
});
