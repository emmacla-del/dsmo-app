import assert from "node:assert/strict";
import test from "node:test";

import { isBackgroundRefreshing } from "./admin-query-state";

test("background refresh requires both an active request and existing data", () => {
  assert.equal(isBackgroundRefreshing(true, undefined), false);
  assert.equal(isBackgroundRefreshing(false, [{ id: "old-row" }]), false);
  assert.equal(isBackgroundRefreshing(true, [{ id: "old-row" }]), true);
  assert.equal(isBackgroundRefreshing(true, []), true);
});
