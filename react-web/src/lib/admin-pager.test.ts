// The numbered pager shows first, last and the current page's neighbours.
//
// Pure logic, no DOM — run with `npm test`.
import assert from "node:assert/strict";
import test from "node:test";

import { pagerWindow } from "@/components/admin/AdminPager";

test("pagerWindow lists every page up to seven", () => {
  assert.deepEqual(pagerWindow(3, 5), [1, 2, 3, 4, 5]);
});

test("pagerWindow keeps first, last and the neighbours of the current page", () => {
  assert.deepEqual(pagerWindow(1, 20), [1, 2, "gap", 20]);
  assert.deepEqual(pagerWindow(10, 20), [1, "gap", 9, 10, 11, "gap", 20]);
  assert.deepEqual(pagerWindow(20, 20), [1, "gap", 19, 20]);
});
