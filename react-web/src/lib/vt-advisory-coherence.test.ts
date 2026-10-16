import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import type { FormData, OnefopField } from "./onefop-schema";
import { vtAdvisoryCheckKey, vtAdvisoryFlags, vtAdvisoryItemsForTables } from "./vt-advisory-coherence";

// The advisory 4.2/4.7, 4.2/4.8 and 4.7/4.10 flags on the table screens
// (CLAUDE.md §7: advisory until domain review).

const s4 = schemaEntity("vocationalTraining").sections.find((s) => s.id === "section4_vocationalTraining")!;
const field = (id: string) => s4.fields.find((f) => f.id === id) as OnefopField;

/** A complete table of zeros: every row of a fixed-row table, the first of a row-by-row one. */
function filled(fieldId: string): FormData {
  const f = field(fieldId);
  const vt = f.table!.vt!;
  const rows = vt.progressiveRows || vt.isRoster ? f.table!.matrix!.slice(0, 1) : f.table!.matrix!;
  const out: FormData = {};
  for (const rowIds of rows) {
    rowIds.forEach((cellId, c) => {
      const kind = vt.cells[c]?.kind;
      if (kind === "number") out[cellId] = 0;
      else if (kind === "text") out[cellId] = "Test";
    });
  }
  return out;
}

const AGE = { code: "VT_TRAINEE_AGE_ENTRANT_MISMATCH", message: "(4.2: 10, hommes) … (4.7 entrants: 8, hommes)." };
const EDU = { code: "VT_TRAINEE_EDU_LEVEL_ENTRANT_MISMATCH", message: "(4.2: 10, femmes) … (4.8 entrants: 9, femmes)." };
const OUT = { code: "VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH", message: "(4.7 sortants: 3, hommes) … (4.10: 5, hommes)." };
const BLOCKING = { code: "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH", message: "(4.1: 12, hommes) … (4.2: 10, hommes)." };

test("only the advisory rules are kept: the same-population ones already block in the wizard", () => {
  assert.deepEqual(vtAdvisoryFlags([BLOCKING, AGE, { code: "S22Q03_DIPLOMA_MISMATCH", message: "" }, OUT]), [AGE, OUT]);
});

test("each flag shows on both of its tables, and points to the one not on screen", () => {
  const flags = [AGE, EDU, OUT];
  assert.deepEqual(
    vtAdvisoryItemsForTables(flags, ["VT4_7"]).map((i) => [i.flag.code, i.otherTables.map((t) => t.code)]),
    [
      ["VT_TRAINEE_AGE_ENTRANT_MISMATCH", ["4.2"]],
      ["VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH", ["4.10"]],
    ],
  );
  assert.deepEqual(
    vtAdvisoryItemsForTables(flags, ["VT4_2"]).map((i) => i.otherTables.map((t) => t.fieldId)),
    [["VT4_7"], ["VT4_8"]],
  );
  assert.deepEqual(vtAdvisoryItemsForTables(flags, ["VT4_1"]), [], "a table the rules do not compare shows nothing");
  assert.deepEqual(vtAdvisoryItemsForTables([], ["VT4_7"]), []);
});

test("nothing is asked until both tables of a compared pair are complete", () => {
  assert.equal(vtAdvisoryCheckKey(s4.fields, {}), null);
  assert.equal(vtAdvisoryCheckKey(s4.fields, filled("VT4_2")), null, "4.2 alone");
  assert.equal(vtAdvisoryCheckKey(s4.fields, { ...filled("VT4_2"), ...filled("VT4_10") }), null, "4.2 and 4.10 are not compared");
  const partial47 = Object.fromEntries(Object.entries(filled("VT4_7")).slice(1));
  assert.equal(vtAdvisoryCheckKey(s4.fields, { ...filled("VT4_2"), ...partial47 }), null, "4.7 still has a cell to fill");
  assert.notEqual(vtAdvisoryCheckKey(s4.fields, { ...filled("VT4_2"), ...filled("VT4_7") }), null);
  assert.notEqual(vtAdvisoryCheckKey(s4.fields, { ...filled("VT4_2"), ...filled("VT4_8") }), null);
});

test("the key changes with a compared cell, and only with one", () => {
  const data = { ...filled("VT4_2"), ...filled("VT4_7") };
  const key = vtAdvisoryCheckKey(s4.fields, data);
  const cell47 = Object.keys(filled("VT4_7"))[0];
  assert.notEqual(vtAdvisoryCheckKey(s4.fields, { ...data, [cell47]: 4 }), key);
  const cell41 = Object.keys(filled("VT4_1"))[0];
  assert.equal(vtAdvisoryCheckKey(s4.fields, { ...data, [cell41]: 4 }), key, "4.1 is not read by these rules");
});
