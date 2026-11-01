import { test } from "node:test";
import assert from "node:assert/strict";
import { vtFindingFigures, vtTableAnchor } from "./vt-finding-figures";

test("both tables and both totals are read from a stored VT warning", () => {
  assert.deepEqual(
    vtFindingFigures("Effectif total des apprenants par diplôme académique (4.1: 12, hommes) ne correspond pas au total par diplôme professionnel (4.2: 10, hommes)."),
    [
      { label: "4.1", code: "4.1", value: 12, sex: "male" },
      { label: "4.2", code: "4.2", value: 10, sex: "male" },
    ],
  );
});

test("a qualified table keeps its name and its paper number", () => {
  const figures = vtFindingFigures("Effectif des apprenants en formation initiale par spécialité (4.5 FI: 7, femmes) ne correspond pas au total par année d'études (4.6: 9, femmes).");
  assert.deepEqual(figures.map((f) => [f.label, f.code, f.value, f.sex]), [["4.5 FI", "4.5", 7, "female"], ["4.6", "4.6", 9, "female"]]);
  assert.equal(vtTableAnchor("4.10"), "dossier-vt-4-10");
});

test("a warning without figures yields none", () => {
  assert.deepEqual(vtFindingFigures("Incohérence statistique détectée"), []);
  assert.deepEqual(vtFindingFigures(null), []);
});
