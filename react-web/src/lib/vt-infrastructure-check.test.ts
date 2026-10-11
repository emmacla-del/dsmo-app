import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaField } from "@/test/schema";
import { vt53Issue, vt53TotalMismatches } from "./vt-infrastructure-check";

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

// Blocking since 2026-10-11 (constitution §7): the issue Suivant and
// submission check.
test("a disagreeing row is one blocking issue on 5.3, naming each row", () => {
  const issue = vt53Issue([field], { ...classrooms(10, 4, 3, 2), s5q3_bureaux_totalCount: 1, s5q3_bureaux_permanentGoodCount: 0, s5q3_bureaux_permanentBadCount: 0, s5q3_bureaux_temporaryCount: 0 });
  assert.ok(issue);
  assert.equal(issue.fieldId, "VT5_6");
  assert.match(issue.fr, /Salle de classe : total 10, mais 4 \+ 3 \+ 2 = 9 ; Bureaux : total 1, mais 0 \+ 0 \+ 0 = 0\.$/);
  assert.match(issue.en, /Classrooms: total 10, but 4 \+ 3 \+ 2 = 9; Offices: total 1, but 0 \+ 0 \+ 0 = 0\.$/);
});

test("no issue when the rows agree, when 5.3 is not among the fields, or for a closed centre", () => {
  assert.equal(vt53Issue([field], classrooms(9, 4, 3, 2)), null);
  assert.equal(vt53Issue([schemaField("vocationalTraining", "VT5_7")], classrooms(10, 4, 3, 2)), null);
  assert.equal(vt53Issue([field], { ...classrooms(10, 4, 3, 2), VT1_12: "Fermée" }), null);
});

test("Section 5's validation (what Suivant checks) blocks on a 5.3 disagreement", async () => {
  const { schemaEntity } = await import("@/test/schema");
  const { validateSectionData } = await import("./onefop-validation");
  const s5 = schemaEntity("vocationalTraining").sections.find((s) => s.id === "section5_vocationalTraining")!;
  const at53 = (data: Record<string, unknown>) => validateSectionData(s5, data, "fr").filter((i) => i.fieldId === "VT5_6" && /somme des trois états/.test(i.message));
  assert.equal(at53(classrooms(10, 4, 3, 2)).length, 1);
  assert.equal(at53(classrooms(9, 4, 3, 2)).length, 0);
});
