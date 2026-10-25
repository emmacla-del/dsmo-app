import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopField, OnefopSchema } from "@/lib/onefop-schema";
import { buildVtFixedRowGridDefinition } from "./vtFixedRowGrid";
import {
  blankCellKeys,
  bodyRowsOf,
  parseCount,
  parsePastedGrid,
  planCopyDown,
  planPaste,
  planZeroEmptyRows,
  snapshotOf,
  typedCellCount,
} from "./gridEntry";
import type { FixedMatrixDefinition } from "./StatisticalTableDefinition";

const schema: OnefopSchema = JSON.parse(
  readFileSync(join(process.cwd(), "public", "schemas", "onefop.schema.json"), "utf8"),
);
const vtField = (id: string): OnefopField =>
  schema.entities.vocationalTraining.sections.flatMap((s) => s.fields).find((f) => f.id === id)!;

/** A small table of counts: two rows, "Hommes" / "Femmes" and a calculated total. */
function miniTable(): FixedMatrixDefinition {
  const row = (id: string) => ({
    id,
    label: { fr: id, en: id },
    cells: {
      male: { key: "male", fieldKey: `${id}_male`, kind: "number" as const, min: 0 },
      female: { key: "female", fieldKey: `${id}_female`, kind: "number" as const, min: 0 },
      total: { key: "total", fieldKey: `${id}_total`, kind: "computed" as const },
    },
  });
  return {
    id: "mini",
    paperCode: "0.0",
    title: { fr: "Mini", en: "Mini" },
    type: "fixed-matrix",
    rowHeaderLabel: { fr: "Ligne", en: "Row" },
    columns: [
      { key: "male", header: { fr: "Hommes", en: "Men" }, kind: "number" },
      { key: "female", header: { fr: "Femmes", en: "Women" }, kind: "number" },
      { key: "total", header: { fr: "Total", en: "Total" }, kind: "computed" },
    ],
    rows: [row("r1"), row("r2")],
    hasTotalRow: true,
  };
}

/* ── parseCount: a count of people is a whole number ─────────────────── */

test("parseCount takes a whole count, and a blank as no answer", () => {
  assert.deepEqual(parseCount("12"), { ok: true, value: 12 });
  assert.deepEqual(parseCount("  7 "), { ok: true, value: 7 });
  assert.deepEqual(parseCount("0"), { ok: true, value: 0 });
  assert.deepEqual(parseCount(""), { ok: true, value: null });
});

test("parseCount strips the digit groups a spreadsheet pastes", () => {
  assert.deepEqual(parseCount("1 234"), { ok: true, value: 1234 });
  assert.deepEqual(parseCount("1 234"), { ok: true, value: 1234 });
  assert.deepEqual(parseCount("1.234"), { ok: true, value: 1234 });
});

test("parseCount refuses a decimal, a sign, an exponent and anything else", () => {
  for (const raw of ["1.5", "1,5", "-3", "+3", "1e3", "12a", "douze", "3/4"]) {
    assert.deepEqual(parseCount(raw), { ok: false, reason: "notWhole" }, raw);
  }
});

test("parseCount holds the cell's own range", () => {
  assert.deepEqual(parseCount("5", { max: 4 }), { ok: false, reason: "outOfRange" });
  assert.deepEqual(parseCount("0", { min: 1 }), { ok: false, reason: "outOfRange" });
  assert.deepEqual(parseCount("4", { min: 1, max: 4 }), { ok: true, value: 4 });
});

/* ── parsePastedGrid ─────────────────────────────────────────────────── */

test("parsePastedGrid reads a spreadsheet block, whatever its line endings", () => {
  assert.deepEqual(parsePastedGrid("1\t2\r\n3\t4\r\n"), [["1", "2"], ["3", "4"]]);
  assert.deepEqual(parsePastedGrid("7"), [["7"]]);
  assert.deepEqual(parsePastedGrid(""), []);
});

/* ── planPaste ───────────────────────────────────────────────────────── */

test("a pasted block lands at the focused cell and spreads right and down", () => {
  const def = miniTable();
  const plan = planPaste(def, 0, 0, [["1", "2"], ["3", "4"]]);
  assert.deepEqual(plan.updates, {
    r1_male: 1,
    r1_female: 2,
    r2_male: 3,
    r2_female: 4,
  });
  assert.equal(plan.rejected, 0);
  assert.equal(plan.computedSkipped, 0);
  assert.equal(plan.outside, 0);
});

test("a paste never writes a calculated cell, and says how many it left", () => {
  const def = miniTable();
  const plan = planPaste(def, 0, 0, [["1", "2", "99"]]);
  assert.deepEqual(plan.updates, { r1_male: 1, r1_female: 2 });
  assert.equal(plan.computedSkipped, 1);
});

test("a paste refuses a value that is not a whole count and keeps the rest", () => {
  const def = miniTable();
  const plan = planPaste(def, 0, 0, [["1", "2.5"]]);
  assert.deepEqual(plan.updates, { r1_male: 1 });
  assert.equal(plan.rejected, 1);
});

test("a paste reports the values that fall outside the table, ignoring empty ones", () => {
  const def = miniTable();
  const plan = planPaste(def, 1, 0, [["1", "2", "", ""], ["9", "9"]]);
  assert.deepEqual(plan.updates, { r2_male: 1, r2_female: 2 });
  // The second line has no row to land on; the two trailing blanks do not count.
  assert.equal(plan.outside, 2);
});

test("a pasted blank clears the cell rather than writing a zero", () => {
  const def = miniTable();
  const plan = planPaste(def, 0, 0, [["", "4"]]);
  assert.deepEqual(plan.updates, { r1_male: null, r1_female: 4 });
});

/* ── blanks and the empty-row fill ───────────────────────────────────── */

test("blankCellKeys counts only the cells the respondent types into", () => {
  const def = miniTable();
  const data: FormData = { r1_male: 3, r1_total: 3 };
  assert.deepEqual(blankCellKeys(def, data), ["r1_female", "r2_male", "r2_female"]);
  assert.equal(typedCellCount(def), 4);
});

test("an explicit zero is an answer, so it is not a blank", () => {
  const def = miniTable();
  const data: FormData = { r1_male: 0, r1_female: 0, r2_male: 0, r2_female: 0 };
  assert.deepEqual(blankCellKeys(def, data), []);
});

test("putting 0 in the empty rows fills a wholly blank row only", () => {
  const def = miniTable();
  // r1 holds one figure, so its blank is the respondent's to answer (§9).
  const plan = planZeroEmptyRows(def, { r1_male: 2 });
  assert.deepEqual(plan.updates, { r2_male: 0, r2_female: 0 });
  assert.equal(plan.rows, 1);
});

test("a row already answered with zeros is not filled again", () => {
  const def = miniTable();
  const plan = planZeroEmptyRows(def, { r1_male: 0, r1_female: 0, r2_male: 0, r2_female: 0 });
  assert.deepEqual(plan.updates, {});
  assert.equal(plan.rows, 0);
});

test("the empty-row fill never writes a calculated cell", () => {
  const def = miniTable();
  const plan = planZeroEmptyRows(def, {});
  assert.deepEqual(Object.keys(plan.updates).sort(), ["r1_female", "r1_male", "r2_female", "r2_male"]);
});

/* ── copy down ───────────────────────────────────────────────────────── */

test("Ctrl+D recopies the cell above", () => {
  const def = miniTable();
  assert.deepEqual(planCopyDown(def, 1, 0, { r1_male: 5 }), { r2_male: 5 });
});

test("Ctrl+D does nothing on the first row, over a blank, or on a calculated cell", () => {
  const def = miniTable();
  assert.equal(planCopyDown(def, 0, 0, { r1_male: 5 }), null);
  assert.equal(planCopyDown(def, 1, 0, {}), null);
  assert.equal(planCopyDown(def, 1, 2, { r1_total: 5 }), null);
});

/* ── undo snapshot ───────────────────────────────────────────────────── */

test("a snapshot remembers a blank as a blank, so undo restores it", () => {
  const before = snapshotOf(["r1_male", "r1_female"], { r1_male: 4 });
  assert.deepEqual(before, { r1_male: 4, r1_female: null });
});

/* ── the real VT tables ──────────────────────────────────────────────── */

test("VT 5.3's typed total is pasteable, and its calculated siblings are not", () => {
  // 5.3 (VT5_6) is the table whose "Nombre total de locaux" the respondent
  // types, and whose blocking check compares it with the three breakdown
  // columns — so a paste must be able to write all four.
  const def = buildVtFixedRowGridDefinition(vtField("VT5_6"));
  const rows = bodyRowsOf(def);
  const plan = planPaste(def, 0, 0, [def.columns.map(() => "2")]);
  const typed = def.columns.filter((c) => c.kind === "number").length;
  assert.equal(Object.keys(plan.updates).length, typed);
  assert.equal(plan.computedSkipped, def.columns.length - typed);
  for (const col of def.columns) {
    if (col.kind !== "number") continue;
    assert.equal(plan.updates[rows[0].cells[col.key].fieldKey], 2);
  }
});

test("VT 4.8's calculated totals are left to the totals layer", () => {
  const def = buildVtFixedRowGridDefinition(vtField("VT4_8"));
  const computed = def.columns.filter((c) => c.kind === "computed");
  assert.ok(computed.length > 0, "4.8 has calculated total columns");
  const plan = planPaste(def, 0, 0, [def.columns.map(() => "1")]);
  for (const col of computed) {
    for (const row of bodyRowsOf(def)) {
      assert.ok(!(row.cells[col.key].fieldKey in plan.updates));
    }
  }
  assert.equal(plan.computedSkipped, computed.length);
});
