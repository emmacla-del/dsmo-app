// Pins the two conversions between the registration wire format and the
// native date control. The server and the stored draft keep DD/MM/YYYY;
// <input type="date"> uses YYYY-MM-DD.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { dateForCalendar, dateFromCalendar } from "./register-date";

test("dateForCalendar reads the stored day, month and year", () => {
  assert.equal(dateForCalendar("31/12/2026"), "2026-12-31");
  assert.equal(dateForCalendar("01/01/2025"), "2025-01-01");
});

test("dateForCalendar returns an empty date control value for a missing or malformed date", () => {
  assert.equal(dateForCalendar(undefined), "");
  assert.equal(dateForCalendar(""), "");
  assert.equal(dateForCalendar("2026-12-31"), "");
  assert.equal(dateForCalendar("31/12"), "");
  assert.equal(dateForCalendar("31/12/2026 extra"), "");
});

test("dateFromCalendar writes the stored format from the date control", () => {
  assert.equal(dateFromCalendar("2026-12-31"), "31/12/2026");
  assert.equal(dateFromCalendar("2025-01-01"), "01/01/2025");
});

test("dateFromCalendar clears the stored value when the control is cleared or malformed", () => {
  assert.equal(dateFromCalendar(""), "");
  assert.equal(dateFromCalendar("31/12/2026"), "");
  assert.equal(dateFromCalendar("2026-12"), "");
});

test("the two conversions round-trip a stored date", () => {
  const stored = "29/02/2024";
  assert.equal(dateFromCalendar(dateForCalendar(stored)), stored);
});
