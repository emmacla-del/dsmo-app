import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anomalyRevision,
  buildResolveAnomalyPayload,
  resolveAnomalyRecord,
  type AnomalyResolutionType,
  type AnomalyRecord,
} from "./anomaly-registry";

const dossierRevision = 17;
const revisionSource = {
  submission: { id: "submission-1", submissionId: "ref-1", revision: dossierRevision, updatedAt: "2026-10-29T10:00:00.123Z" },
} as Pick<AnomalyRecord, "submission">;

async function assertResolutionRequestIncludesRevision(resolutionType: AnomalyResolutionType) {
  const payload = buildResolveAnomalyPayload(
    revisionSource,
    resolutionType,
    "The review evidence supports this resolution.",
  );
  assert.ok(payload);
  assert.equal(payload.expectedRevision, dossierRevision);

  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ id: "anomaly-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await resolveAnomalyRecord("anomaly-1", payload);
    assert.match(requestUrl, /\/admin\/questionnaires\/anomalies\/anomaly-1\/resolve$/);
    assert.deepEqual(JSON.parse(requestBody), {
      resolutionType,
      resolutionNote: "The review evidence supports this resolution.",
      expectedRevision: dossierRevision,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("ordinary anomaly resolution request includes the dossier monotonic revision", async () => {
  await assertResolutionRequestIncludesRevision("DECLARANT_CORRECTION");
});

test("legal waiver request includes the dossier monotonic revision", async () => {
  await assertResolutionRequestIncludesRevision("LEGAL_DEROGATION");
});

test("revision payloads require a nonnegative safe integer and refuse unavailable revisions", () => {
  assert.equal(anomalyRevision(revisionSource), dossierRevision);
  assert.equal(anomalyRevision({ submission: null }), null);
  assert.equal(anomalyRevision({ submission: { revision: 1.5 } as NonNullable<AnomalyRecord["submission"]> }), null);
  assert.equal(anomalyRevision({ submission: { revision: -1 } as NonNullable<AnomalyRecord["submission"]> }), null);
  assert.equal(anomalyRevision({ submission: { revision: 2147483648 } as NonNullable<AnomalyRecord["submission"]> }), null);
  assert.equal(anomalyRevision({ submission: { revision: Number.MAX_SAFE_INTEGER + 1 } as NonNullable<AnomalyRecord["submission"]> }), null);
  assert.equal(
    buildResolveAnomalyPayload({ submission: null }, "FIELD_INSPECTION", "A sufficiently detailed note."),
    null,
  );
});

test("revision zero is a valid first dossier revision and remains numeric in the payload", () => {
  const zeroRevisionSource = {
    submission: { id: "submission-new", submissionId: "ref-new", revision: 0, updatedAt: "2026-10-29T10:00:00.000Z" },
  } as Pick<AnomalyRecord, "submission">;
  const payload = buildResolveAnomalyPayload(
    zeroRevisionSource,
    "FIELD_INSPECTION",
    "A sufficiently detailed note.",
  );
  assert.deepEqual(payload, {
    resolutionType: "FIELD_INSPECTION",
    resolutionNote: "A sufficiently detailed note.",
    expectedRevision: 0,
  });
});
