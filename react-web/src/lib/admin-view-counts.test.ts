import assert from "node:assert/strict";
import test from "node:test";
import { selectAdminViewCounts } from "./admin-view-counts";

test("status totals are used only for the requested view", () => {
  const totals = { pending: 4, approved: 3 };
  assert.deepEqual(selectAdminViewCounts("queue", "queue", totals), totals);
  assert.deepEqual(selectAdminViewCounts("completed", "completed", totals), totals);
  assert.equal(selectAdminViewCounts("organisations", "queue", totals), null);
  assert.equal(selectAdminViewCounts("queue", "organisations", totals), null);
  assert.equal(selectAdminViewCounts("queue", "completed", totals), null);
  assert.equal(selectAdminViewCounts(undefined, "queue", totals), null);
});
