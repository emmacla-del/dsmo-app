import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api-client";
import { saveDraftToBackend, submitDeclaration } from "./onefop-submission";

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

// ── The draft save sent when the respondent closes the page (audit R2) ───

function recordRequest() {
  const calls: RequestInit[] = [];
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return calls;
}

test("a draft saved on leaving is sent keepalive, so closing the tab does not cancel it", async () => {
  const original = globalThis.fetch;
  try {
    const calls = recordRequest();
    await saveDraftToBackend("vocationalTraining", "QUARTERLY_2026_T4", { VT1_2: "Waltz" }, null, { keepalive: true });
    assert.equal(calls[0].keepalive, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("an ordinary save is not keepalive", async () => {
  const original = globalThis.fetch;
  try {
    const calls = recordRequest();
    await saveDraftToBackend("vocationalTraining", "QUARTERLY_2026_T4", { VT1_2: "Waltz" }, null);
    assert.equal(calls[0].keepalive, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("a draft too big for a keepalive body is sent as an ordinary request, not dropped", async () => {
  const original = globalThis.fetch;
  try {
    const calls = recordRequest();
    const big: Record<string, string> = {};
    for (let i = 0; i < 3000; i++) big[`cell_${i}`] = "0123456789012345678901234567890";
    await saveDraftToBackend("vocationalTraining", "QUARTERLY_2026_T4", big, null, { keepalive: true });
    assert.ok(String(calls[0].body).length > 60 * 1024, "the body is over the browser's cap");
    assert.equal(calls[0].keepalive, false, "sent anyway, without keepalive");
  } finally {
    globalThis.fetch = original;
  }
});
