import assert from "node:assert/strict";
import { test } from "node:test";

import { ENTITY_CONFIGS, YEAR_OPTIONS_FROM, yearOptions } from "@/lib/register-constants";

const NOW = new Date(2026, 9, 21);

test("yearOptions runs from this year down to the first year offered", () => {
  const years = yearOptions(undefined, NOW);
  assert.equal(years[0], "2026");
  assert.equal(years[years.length - 1], String(YEAR_OPTIONS_FROM));
  assert.equal(years.length, 2026 - YEAR_OPTIONS_FROM + 1);
});

test("yearOptions keeps a stored value the list does not hold", () => {
  // A draft typed before the field became a list must still be visible.
  assert.equal(yearOptions("1850", NOW)[0], "1850");
  assert.equal(yearOptions("2010", NOW).filter((y) => y === "2010").length, 1);
});

test("every year of creation is a year dropdown", () => {
  for (const config of Object.values(ENTITY_CONFIGS)) {
    for (const field of config.fields) {
      if (field.key === "yearOfCreation") assert.equal(field.kind, "year");
    }
  }
});
