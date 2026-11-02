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

test("a decision needs the reviewer's own live claim: unclaimed, someone else's or expired files are not eligible", async () => {
  const { assessBulkEligibility } = await import("./dossier-bulk-eligibility");
  const rows = [
    { id: "mine", status: "PENDING_REVIEW", blockingCount: 0, assigneeId: "me" },
    { id: "free", status: "PENDING_REVIEW", blockingCount: 0, assigneeId: null },
    { id: "theirs", status: "PENDING_REVIEW", blockingCount: 0, assigneeId: "them" },
    { id: "lapsed", status: "PENDING_REVIEW", blockingCount: 0, assigneeId: "me", claimExpired: true },
  ];
  const result = assessBulkEligibility(rows, new Set(rows.map((row) => row.id)), "me");
  assert.deepEqual(result.endorsementEligible.map((row) => row.id), ["mine"]);
  assert.deepEqual(result.correctionEligible.map((row) => row.id), ["mine"]);
  assert.deepEqual(result.rejectionEligible.map((row) => row.id), ["mine"]);
  assert.deepEqual(result.excluded.map((row) => row.id), ["free", "theirs", "lapsed"]);
  // No reviewer known: nothing is eligible, rather than everything.
  assert.equal(assessBulkEligibility(rows, new Set(["mine"]), null).eligible.length, 0);
});

test("bulk claim goes one file at a time and reports every outcome", async () => {
  const { claimFilesInTurn } = await import("./dossier-bulk-eligibility");
  const order: string[] = [];
  let inFlight = 0;
  const outcome = await claimFilesInTurn(["a", "b", "c"], async (id) => {
    inFlight += 1;
    assert.equal(inFlight, 1, "never two claims at once");
    order.push(id);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight -= 1;
    if (id === "b") throw new Error("Déjà réclamé par un autre agent.");
  });
  assert.deepEqual(order, ["a", "b", "c"], "a refusal does not stop the others");
  assert.equal(outcome.claimed, 2);
  assert.deepEqual(outcome.failed, [{ id: "b", message: "Déjà réclamé par un autre agent." }]);
});
