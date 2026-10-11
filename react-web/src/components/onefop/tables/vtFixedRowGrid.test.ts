import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OnefopField, OnefopSchema } from "@/lib/onefop-schema";
import { buildVtFixedRowGridDefinition, isVtFixedRowTable, vtFixedRowTotalsToSave, withVtFixedRowTotals } from "./vtFixedRowGrid";

const schema: OnefopSchema = JSON.parse(
  readFileSync(join(process.cwd(), "public", "schemas", "onefop.schema.json"), "utf8"),
);
const vtFields: OnefopField[] = schema.entities.vocationalTraining.sections.flatMap((s) => s.fields);
const fixedRowTables = vtFields.filter(isVtFixedRowTable);
const byId = (id: string) => fixedRowTables.find((f) => f.id === id)!;

test("the grid covers exactly the VT fixed-row tables", () => {
  assert.deepEqual(
    fixedRowTables.map((f) => f.id).sort(),
    ["VT4_1", "VT4_11", "VT4_2", "VT4_7", "VT4_8", "VT4_9", "VT5_6", "VT5_7", "VT8_1", "VT8_2", "VT8_3", "VT8_6"].sort(),
  );
  // Rosters and variable-length lists keep their own entry.
  for (const id of ["VT8_8", "VT4_3", "VT4_5", "VT5_5", "VT6_13"]) {
    const field = vtFields.find((f) => f.id === id);
    assert.ok(field && !isVtFixedRowTable(field), id);
  }
});

test("every grid cell is bound to the schema's own field key for that row and column", () => {
  for (const field of fixedRowTables) {
    const def = buildVtFixedRowGridDefinition(field);
    const vt = field.table!.vt!;
    assert.equal(def.rows.length, vt.rows.length, field.id);
    def.rows.forEach((row, i) => {
      vt.cells.forEach((cell, j) => {
        assert.equal(row.cells[cell.key].fieldKey, field.table!.matrix![i][j], `${field.id} ${row.id} ${cell.key}`);
        assert.equal(row.cells[cell.key].kind, cell.kind === "computed" ? "computed" : "number");
      });
    });
  }
});

test("grouped columns get a header per group (4.8: Incoming / Outgoing / Dropouts)", () => {
  const def = buildVtFixedRowGridDefinition(byId("VT4_8"));
  assert.deepEqual(def.headerGroups?.map((g) => [g.title.en, g.colSpan]), [
    ["Incoming", 3],
    ["Outgoing", 3],
    ["Dropouts", 3],
  ]);
  assert.deepEqual(def.columns.map((c) => c.header.en), ["Men", "Women", "Σ Total", "Men", "Women", "Σ Total", "Men", "Women", "Σ Total"]);
});

test("5.3 as on paper: Total | Permanent (Good, Bad) | Temporary", () => {
  const def = buildVtFixedRowGridDefinition(byId("VT5_6"));
  assert.deepEqual(def.headerGroups?.map((g) => [g.title.fr, g.colSpan]), [["Définitif", 2]]);
  assert.deepEqual(
    def.columns.map((c) => [c.header.fr, c.group?.fr ?? null]),
    [
      ["Nombre total de locaux", null],
      ["Bon état", "Définitif"],
      ["Mauvais état", "Définitif"],
      ["Provisoire", null],
    ],
  );
});

test("a table with no grouped label has no header band (8.1)", () => {
  assert.equal(buildVtFixedRowGridDefinition(byId("VT8_1")).headerGroups, undefined);
});

test("each total adds up only its own group", () => {
  const field = byId("VT4_8");
  const r = field.table!.matrix![0];
  const shown = withVtFixedRowTotals(field, { [r[0]]: 2, [r[1]]: 3, [r[3]]: 5, [r[6]]: "1" });
  assert.equal(shown[r[2]], 5); // incoming men + women
  assert.equal(shown[r[5]], 5); // outgoing men only
  assert.equal(shown[r[8]], 1); // dropouts men only
});

test("a row with nothing entered shows no total (not 0)", () => {
  const field = byId("VT8_1");
  const r = field.table!.matrix![0];
  assert.equal(withVtFixedRowTotals(field, {})[r[2]], null);
});

test("the grid's own whole-row sum is off (it would put the full row into the first group's total)", () => {
  for (const field of fixedRowTables) {
    const def = buildVtFixedRowGridDefinition(field);
    assert.deepEqual(def.recalc!({ any: 1 }, def.id, []), {}, field.id);
  }
});

test("a table without computed cells is passed through unchanged", () => {
  const data = { x: 1 };
  assert.equal(withVtFixedRowTotals(byId("VT8_3"), data), data);
});

test("totals to save: each group's sum for every entered row", () => {
  const field = byId("VT4_8");
  const r = field.table!.matrix![0];
  assert.deepEqual(vtFixedRowTotalsToSave(field, { [r[0]]: 2, [r[1]]: 3, [r[3]]: 5 }), {
    [r[2]]: 5,
    [r[5]]: 5,
  });
});

test("nothing to save once stored totals match, so the writes settle", () => {
  const field = byId("VT4_2");
  const r = field.table!.matrix![0];
  assert.deepEqual(vtFixedRowTotalsToSave(field, { [r[0]]: 3, [r[1]]: 2, [r[2]]: 5 }), {});
  assert.deepEqual(vtFixedRowTotalsToSave(field, { [r[0]]: "3", [r[1]]: 2, [r[2]]: "5" }), {});
});

test("a stale total is corrected, and cleared when its row is emptied", () => {
  const field = byId("VT8_1");
  const r = field.table!.matrix![0];
  assert.deepEqual(vtFixedRowTotalsToSave(field, { [r[0]]: 4, [r[1]]: 1, [r[2]]: 3 }), { [r[2]]: 5 });
  assert.deepEqual(vtFixedRowTotalsToSave(field, { [r[2]]: 3 }), { [r[2]]: null });
});

test("tables without a total column have nothing to save", () => {
  const field = byId("VT8_3");
  const r = field.table!.matrix![0];
  assert.deepEqual(vtFixedRowTotalsToSave(field, { [r[0]]: 1, [r[1]]: 2 }), {});
});
