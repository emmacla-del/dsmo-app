// Pins the redirect target for the Couverture view, which moved from
// /admin/cibles to /admin/inscriptions. Old ?vue=couverture links must land on
// the same view, for the same year, after a reload as much as after a click.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { coverageHref, YEAR_MAX, YEAR_MIN } from "./pilotage-targets";

test("a valid ?annee= is carried over to the coverage view", () => {
  assert.equal(coverageHref("2025"), "/admin/inscriptions?vue=couverture&annee=2025");
  assert.equal(coverageHref(" 2024 "), "/admin/inscriptions?vue=couverture&annee=2024");
  assert.equal(coverageHref(2026), "/admin/inscriptions?vue=couverture&annee=2026");
});

test("a missing or invalid year is dropped, not forwarded", () => {
  const bare = "/admin/inscriptions?vue=couverture";
  assert.equal(coverageHref(null), bare);
  assert.equal(coverageHref(""), bare);
  assert.equal(coverageHref("abc"), bare);
  assert.equal(coverageHref("2025&vue=quotas"), bare);
  assert.equal(coverageHref(String(YEAR_MIN - 1)), bare);
  assert.equal(coverageHref(String(YEAR_MAX + 1)), bare);
});
