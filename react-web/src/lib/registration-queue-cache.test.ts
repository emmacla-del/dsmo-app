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
