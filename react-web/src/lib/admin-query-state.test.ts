import assert from "node:assert/strict";
import test from "node:test";

import { adminResultRange, displayedResultOffset, isBackgroundRefreshing } from "./admin-query-state";

test("background refresh requires both an active request and existing data", () => {
  assert.equal(isBackgroundRefreshing(true, undefined), false);
  assert.equal(isBackgroundRefreshing(false, [{ id: "old-row" }]), false);
  assert.equal(isBackgroundRefreshing(true, [{ id: "old-row" }]), true);
  assert.equal(isBackgroundRefreshing(true, []), true);
  assert.equal(isBackgroundRefreshing(false, [{ id: "old-row" }]), false, "a settled success or error clears the busy indicator");
});

test("placeholder rows keep their own page offset until the requested page commits", () => {
  assert.equal(displayedResultOffset(10, 0, true), 0);
  assert.equal(displayedResultOffset(10, 10, false), 10);
});

test("result ranges follow visible rows on the first, last, and empty pages", () => {
  assert.deepEqual(adminResultRange(0, 10, 25), { start: 1, end: 10 });
  assert.deepEqual(adminResultRange(10, 5, 15), { start: 11, end: 15 });
  assert.deepEqual(adminResultRange(30, 0, 25), { start: 0, end: 0 });
});
