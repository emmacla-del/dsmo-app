import { test } from "node:test";
import assert from "node:assert/strict";
import { dossierQueueViewFilters, parseDossierQueueView, resolveDossierQueueView } from "./admin-url";

const bare = { requested: "", status: "", assignment: "", hasOtherFilters: false, readOnly: false } as const;

test("queue views map onto existing list status and assignment filters", () => {
  assert.deepEqual(dossierQueueViewFilters("mine"), { status: "PENDING_REVIEW", assignment: "me" });
  assert.deepEqual(dossierQueueViewFilters("unassigned"), { status: "PENDING_REVIEW", assignment: "unassigned" });
  assert.deepEqual(dossierQueueViewFilters("others"), { status: "PENDING_REVIEW", assignment: "other" });
  assert.deepEqual(dossierQueueViewFilters("pending"), { status: "PENDING_REVIEW" });
  assert.deepEqual(dossierQueueViewFilters("corrections"), { status: "CORRECTION_REQUESTED" });
});

test("completed decisions are a status filter, not an ownership view", () => {
  assert.equal(parseDossierQueueView("corrections"), "corrections");
  assert.equal(parseDossierQueueView("others"), "others");
  assert.equal(parseDossierQueueView("completed"), "");
  assert.equal(parseDossierQueueView("unrecognized"), "");
});

test("an explicit view wins, except where a read-only role may not go", () => {
  assert.equal(resolveDossierQueueView({ ...bare, requested: "unassigned", status: "CORRECTION_REQUESTED" }), "unassigned");
  assert.equal(resolveDossierQueueView({ ...bare, requested: "mine", readOnly: true }), "pending");
  assert.equal(resolveDossierQueueView({ ...bare, requested: "corrections", readOnly: true }), "corrections");
});

test("links from other screens open the view they meant, never the default", () => {
  // pilotage/page.tsx and home/page.tsx
  assert.equal(resolveDossierQueueView({ ...bare, status: "CORRECTION_REQUESTED" }), "corrections");
  assert.equal(resolveDossierQueueView({ ...bare, status: "PENDING_REVIEW" }), "pending");
  // etablissement-detail and inscriptions (?companyId=), the overdue link, pilotage ?sort=oldest
  assert.equal(resolveDossierQueueView({ ...bare, hasOtherFilters: true }), "pending");
  // assignment links (admin-url.test.ts)
  assert.equal(resolveDossierQueueView({ ...bare, assignment: "me" }), "mine");
  assert.equal(resolveDossierQueueView({ ...bare, assignment: "unassigned" }), "unassigned");
  // Files a colleague holds have their own view since 2026-11-09.
  assert.equal(resolveDossierQueueView({ ...bare, assignment: "other" }), "others");
  assert.equal(resolveDossierQueueView({ ...bare, assignment: "other", readOnly: true }), "pending");
  assert.equal(resolveDossierQueueView({ ...bare, status: "PENDING_REVIEW", assignment: "me" }), "mine");
});

test("only a bare URL leaves the default to the caller", () => {
  assert.equal(resolveDossierQueueView(bare), null);
  assert.equal(resolveDossierQueueView({ ...bare, readOnly: true }), "pending");
  // terminal and grouped statuses bypass claim-ownership shortcuts.
  assert.equal(resolveDossierQueueView({ ...bare, status: "APPROVED" }), null);
  assert.equal(resolveDossierQueueView({ ...bare, status: "COMPLETED" }), null);
  assert.equal(resolveDossierQueueView({ ...bare, status: "ALL" }), null);
});
