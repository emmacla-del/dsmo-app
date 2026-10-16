import { test } from "node:test";
import assert from "node:assert/strict";
import { navItemsForRole } from "./role-navigation";
import { REGISTRATION_STATUS_ROUTE, respondentRailItems } from "./respondent-rail";

// Defect 8 of the 2026-10-15 VT run: while a registration awaited approval,
// every rail link was sent back to the status page without a word.

test("awaiting approval: the rail holds only the registration status page", () => {
  const items = respondentRailItems(navItemsForRole("COMPANY"), true);
  assert.equal(items.length, 1);
  assert.equal(items[0].route, REGISTRATION_STATUS_ROUTE);
  assert.equal(items[0].labelKey, "homeNav.item.registrationStatus");
});

test("approved: the rail keeps the role's own items", () => {
  const company = navItemsForRole("COMPANY");
  assert.deepEqual(respondentRailItems(company, false), company);
});
