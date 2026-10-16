import { test } from "node:test";
import assert from "node:assert/strict";
import { respondentFunctionLabel, sectorLabel } from "./display-labels";

// Defect 7 of the 2026-10-15 VT run: stored French values on English screens.

test("a respondent function from the list reads in the reader's language", () => {
  assert.equal(respondentFunctionLabel("Responsable RH", "en"), "HR Manager");
  assert.equal(respondentFunctionLabel("Responsable RH", "fr"), "Responsable RH");
  assert.equal(respondentFunctionLabel("Gérant", "en"), "Manager");
});

test("a function typed by hand stays as typed; none stays empty", () => {
  assert.equal(respondentFunctionLabel("Chargée de mission", "en"), "Chargée de mission");
  assert.equal(respondentFunctionLabel("  ", "en"), "");
  assert.equal(respondentFunctionLabel(null, "en"), "");
});

test("a sector reads in English when it has an English name, else as stored", () => {
  const s = { name: "Enseignement", nameEn: "Education" };
  assert.equal(sectorLabel(s, "en"), "Education");
  assert.equal(sectorLabel(s, "fr"), "Enseignement");
  assert.equal(sectorLabel({ name: "Enseignement", nameEn: null }, "en"), "Enseignement");
  assert.equal(sectorLabel(null, "en"), "");
});
