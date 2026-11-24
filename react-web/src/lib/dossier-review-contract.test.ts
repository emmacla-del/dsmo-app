import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approveDossier,
  assignDossier,
  rejectDossier,
  requestCorrectionDossier,
  reopenDossierForCorrection,
  saveDossierReviewProgress,
} from "./api-client";

async function captureRequest(work: () => Promise<unknown>) {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify({ revision: 8 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await work();
    return calls;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("claim and release use the actual assignment DTO while the backend owns its atomic revision check", async () => {
  const claimCalls = await captureRequest(() => assignDossier("dossier 1", "agent-1"));
  const releaseCalls = await captureRequest(() => assignDossier("dossier 1", null));
  assert.deepEqual(claimCalls[0], {
    url: "http://localhost:3001/api/admin/questionnaires/dossier%201/assign",
    method: "PATCH",
    body: { assigneeId: "agent-1" },
  });
  assert.deepEqual(releaseCalls[0].body, { assigneeId: null });
  assert.equal("expectedRevision" in (claimCalls[0].body as object), false);
});

test("approve, reject, request-correction, reopen, and saved progress preserve the submitted revision", async () => {
  const revision = 7;
  const calls = await captureRequest(async () => {
    await approveDossier("d1", revision);
    await approveDossier("d1", revision, "Reviewed the remaining warnings.");
    await rejectDossier("d1", "Reason long enough", true, revision);
    await requestCorrectionDossier("d1", "Correction details", true, revision);
    await reopenDossierForCorrection("d1", "Reopen reason long enough", true, revision);
    const progress = await saveDossierReviewProgress("d1", "Reviewed the financial evidence.", revision);
    assert.equal(progress.revision, 8, "retain the revision returned by the review-progress API");
  });
  assert.deepEqual(calls.map((call) => call.body), [
    { expectedRevision: revision },
    { expectedRevision: revision, comment: "Reviewed the remaining warnings." },
    { reason: "Reason long enough", certified: true, expectedRevision: revision },
    { comments: "Correction details", certified: true, expectedRevision: revision },
    { reason: "Reopen reason long enough", certified: true, expectedRevision: revision },
    { note: "Reviewed the financial evidence.", expectedRevision: revision },
  ]);
});
