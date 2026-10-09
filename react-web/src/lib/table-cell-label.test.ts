// Pins the accessible name given to statistical-table cells: a readable
// "Row - Group - Column" label, never the technical cell id unless no label
// exists at all.
//
// Pure logic, no DOM — run with `npm test`.

import assert from "node:assert/strict";
import test from "node:test";

import { tableCellLabel } from "./table-cell-label";

test("joins row, group and column labels like StatisticalGridRenderer", () => {
  assert.equal(tableCellLabel(["Cadres", "Permanents", "Hommes"], "s4q3_row1_fiMale"), "Cadres - Permanents - Hommes");
  assert.equal(tableCellLabel(["Cadres", "Hommes"], "x"), "Cadres - Hommes");
});

test("skips missing or blank parts", () => {
  assert.equal(tableCellLabel(["Cadres", undefined, "  ", null, "Total"], "x"), "Cadres - Total");
  assert.equal(tableCellLabel(["", "Hommes"], "x"), "Hommes");
});

test("falls back to the cell id only when no label is available", () => {
  assert.equal(tableCellLabel([], "s4q3_row1_fiMale"), "s4q3_row1_fiMale");
  assert.equal(tableCellLabel([undefined, "", null], "s4q3_row1_fiMale"), "s4q3_row1_fiMale");
});
