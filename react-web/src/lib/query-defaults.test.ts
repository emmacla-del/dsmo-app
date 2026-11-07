import assert from "node:assert/strict";
import test from "node:test";

import { FOCUS_REFETCH_AFTER_MS, refetchOnFocusWhenOld } from "./query-defaults";

const loadedAt = (dataUpdatedAt: number) => ({ state: { dataUpdatedAt } });

test("coming back to the tab leaves recent data alone", () => {
  assert.equal(refetchOnFocusWhenOld(loadedAt(1_000_000), 1_000_000 + FOCUS_REFETCH_AFTER_MS - 1), false);
});

test("coming back to the tab reloads data past the limit", () => {
  assert.equal(refetchOnFocusWhenOld(loadedAt(1_000_000), 1_000_000 + FOCUS_REFETCH_AFTER_MS), true);
});

test("a query that never loaded is retried on focus", () => {
  assert.equal(refetchOnFocusWhenOld(loadedAt(0), 1_000_000_000), true);
});
