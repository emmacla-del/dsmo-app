import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRegistrationDecision } from "./registration-queue-cache";
import type { CompanyRegistrationItem, CompanyRegistrationsResult } from "./user-directory";

const item = (id: string, status: string, overdue = false) =>
  ({ id, status, overdue, waitingSince: overdue ? "2026-10-01T00:00:00Z" : null }) as unknown as CompanyRegistrationItem;

const page = (): CompanyRegistrationsResult => ({
  items: [item("a", "PENDING_APPROVAL", true), item("b", "PENDING_APPROVAL")],
  total: 2,
  page: 1,
  pageSize: 20,
  counts: { pending: 4, complements: 0, approved: 5, rejected: 1, overdue: 1 },
  overdueDays: 7,
});

test("approving a pending file shows it approved and moves the counters at once", () => {
  const next = applyRegistrationDecision(page(), "a", "ACTIVE")!;
  assert.equal(next.items[0].status, "ACTIVE");
  assert.equal(next.items[0].overdue, false);
  assert.equal(next.items[1].status, "PENDING_APPROVAL", "the other row is untouched");
  assert.deepEqual(next.counts, { pending: 3, complements: 0, approved: 6, rejected: 1, overdue: 0 });
});

test("rejecting and asking for complements move the right counters", () => {
  assert.deepEqual(applyRegistrationDecision(page(), "b", "REJECTED")!.counts, { pending: 3, complements: 0, approved: 5, rejected: 2, overdue: 1 });
  assert.deepEqual(applyRegistrationDecision(page(), "b", "COMPLEMENTS_REQUESTED")!.counts, { pending: 3, complements: 1, approved: 5, rejected: 1, overdue: 1 });
});

test("a page without the file, or no page yet, is left as it is", () => {
  const p = page();
  assert.equal(applyRegistrationDecision(p, "zzz", "ACTIVE"), p);
  assert.equal(applyRegistrationDecision(undefined, "a", "ACTIVE"), undefined);
});

// B11 (E2E 2026-10-17): with the list filtered to the review queue, an
// approved row stayed on the page under its new status until the refetch
// answered — in a list that, by its own filter, no longer held it.

test("a decided file leaves a list filtered to the queue it was in", () => {
  const next = applyRegistrationDecision(page(), "a", "ACTIVE", "PENDING_APPROVAL")!;
  assert.deepEqual(next.items.map((i) => i.id), ["b"]);
  assert.equal(next.total, 1);
  assert.deepEqual(next.counts, { pending: 3, complements: 0, approved: 6, rejected: 1, overdue: 0 });
});

test("a decided file stays in a list filtered to the status it moves into", () => {
  const next = applyRegistrationDecision(page(), "a", "ACTIVE", "ACTIVE")!;
  assert.deepEqual(next.items.map((i) => i.id), ["a", "b"]);
  assert.equal(next.items[0].status, "ACTIVE");
  assert.equal(next.total, 2);
});

test("a decided file leaves the overdue view, which no decided file belongs to", () => {
  for (const status of ["ACTIVE", "REJECTED", "COMPLEMENTS_REQUESTED"] as const) {
    const next = applyRegistrationDecision(page(), "a", status, "OVERDUE")!;
    assert.deepEqual(next.items.map((i) => i.id), ["b"], status);
  }
});

test("the unfiltered list keeps the row and only restyles it", () => {
  for (const view of [undefined, ""]) {
    const next = applyRegistrationDecision(page(), "a", "ACTIVE", view)!;
    assert.deepEqual(next.items.map((i) => i.id), ["a", "b"], String(view));
    assert.equal(next.total, 2);
  }
});
