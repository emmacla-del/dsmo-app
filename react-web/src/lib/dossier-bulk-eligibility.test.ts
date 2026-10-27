import assert from "node:assert/strict";
import test from "node:test";
import { assessBulkEligibility } from "./dossier-bulk-eligibility";

const rows = [
  { id: "pending-clean", status: "PENDING_REVIEW", blockingCount: 0 },
  { id: "pending-blocked", status: "PENDING_REVIEW", blockingCount: 1 },
  { id: "correction", status: "CORRECTION_REQUESTED", blockingCount: 0 },
  { id: "approved", status: "APPROVED", blockingCount: 0 },
];

test("bulk preflight disables both actions when no selected row is eligible", () => {
  const result = assessBulkEligibility(rows, new Set(["approved"]));
  assert.equal(result.selected.length, 1);
  assert.equal(result.eligible.length, 0);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.canEndorse, false);
  assert.equal(result.canReject, false);
  assert.equal(result.canCorrect, false);
});

test("bulk preflight separates endorsement and rejection eligibility", () => {
  const result = assessBulkEligibility(rows, new Set(["pending-clean", "pending-blocked", "correction"]));
  assert.deepEqual(result.endorsementEligible.map((row) => row.id), ["pending-clean"]);
  assert.deepEqual(result.rejectionEligible.map((row) => row.id), ["pending-clean", "pending-blocked", "correction"]);
  assert.equal(result.canEndorse, true);
  assert.equal(result.canReject, true);
});

test("bulk correction preflight only asks files awaiting a first decision", () => {
  const result = assessBulkEligibility(rows, new Set(["pending-clean", "pending-blocked", "correction", "approved"]));
  assert.deepEqual(result.correctionEligible.map((row) => row.id), ["pending-clean", "pending-blocked"]);
  assert.equal(result.canCorrect, true);

  const none = assessBulkEligibility(rows, new Set(["correction", "approved"]));
  assert.equal(none.correctionEligible.length, 0);
  assert.equal(none.canCorrect, false);
});
