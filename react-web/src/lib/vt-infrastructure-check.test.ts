import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaField } from "@/test/schema";
import { vt53TotalMismatches } from "./vt-infrastructure-check";

const field = schemaField("vocationalTraining", "VT5_6");
const classrooms = (total: number | null, good: number | null, bad: number | null, temporary: number | null) => ({
  s5q3_salle_classe_totalCount: total,
  s5q3_salle_classe_permanentGoodCount: good,
  s5q3_salle_classe_permanentBadCount: bad,
  s5q3_salle_classe_temporaryCount: temporary,
});

test("a total equal to Good + Bad + Temporary is not flagged", () => {
  assert.deepEqual(vt53TotalMismatches(field, classrooms(9, 4, 3, 2)), []);
});

test("a total that differs is flagged with its row and numbers", () => {
  const [m, ...rest] = vt53TotalMismatches(field, classrooms(10, 4, 3, 2));
  assert.equal(rest.length, 0);
  assert.equal(m.label.fr, "Salle de classe");
  assert.equal(m.total, 10);
  assert.deepEqual(m.parts, [4, 3, 2]);
});

test("a row still being filled in is not flagged", () => {
  assert.deepEqual(vt53TotalMismatches(field, classrooms(10, 4, null, 2)), []);
  assert.deepEqual(vt53TotalMismatches(field, classrooms(null, 4, 3, 2)), []);
});

test("values typed as text are read as numbers", () => {
  assert.deepEqual(vt53TotalMismatches(field, { s5q3_bureaux_totalCount: "5", s5q3_bureaux_permanentGoodCount: "5", s5q3_bureaux_permanentBadCount: "0", s5q3_bureaux_temporaryCount: "0" }), []);
});

test("only 5.3 is checked", () => {
  assert.deepEqual(vt53TotalMismatches(schemaField("vocationalTraining", "VT5_7"), classrooms(10, 4, 3, 2)), []);
});
