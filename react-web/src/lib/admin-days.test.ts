// Pins the day formatters of the pilotage review-delay line: whole days
// waited, rounded down, and a median shown with at most one decimal.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { days, daysSince, NOT_PROVIDED } from "./admin-data-state";

const DAY = 86_400_000;

test("daysSince counts whole days, rounded down", () => {
  const now = Date.UTC(2026, 9, 17, 12);
  assert.equal(daysSince(new Date(now - 12 * DAY - 3600_000).toISOString(), now), 12);
  assert.equal(daysSince(new Date(now - DAY + 1000).toISOString(), now), 0);
  assert.equal(daysSince(new Date(now + DAY).toISOString(), now), 0);
});

test("daysSince is null for a missing or unreadable date, never 0", () => {
  assert.equal(daysSince(null), null);
  assert.equal(daysSince(undefined), null);
  assert.equal(daysSince("not a date"), null);
});

test("days shows at most one decimal, in the console locale", () => {
  assert.equal(days(3.5, "fr"), "3,5 j");
  assert.equal(days(3.5, "en"), "3.5 d");
  assert.equal(days(12, "fr"), "12 j");
  assert.equal(days(0, "fr"), "0 j");
  assert.equal(days(null, "fr"), NOT_PROVIDED);
});
