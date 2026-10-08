import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanHiddenDependentFields, isFieldVisible, type FormData, type OnefopSchema } from "./onefop-schema";
import { validateEntityData } from "./onefop-validation";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;
const vt = schema.entities.vocationalTraining;
const field = (id: string) => vt.sections.flatMap((s) => s.fields).find((f) => f.id === id)!;
const sectionOf = (fieldId: string) => vt.sections.find((s) => s.fields.some((f) => f.id === fieldId))!.id;

/** A valid answer to every required question (parents take their first option, "Oui"). */
function completeAnswers(): FormData {
  const out: FormData = {};
  for (const f of vt.sections.flatMap((s) => s.fields)) {
    if (!f.required || f.table) continue;
    const first = f.options?.[0]?.value;
    if (f.id === "VT1_14") out[f.id] = "2010";
    else if (f.type === "number") out[f.id] = "0";
    else if (f.type === "checkbox") out[f.id] = first ? [first] : ["Réponse"];
    else if (f.type === "tel") out[f.id] = "677000000";
    else if (f.type === "email") out[f.id] = "centre@test.cm";
    else out[f.id] = first ?? "Réponse";
  }
  return out;
}

/** The quiz answered "Non" throughout, and every table that still applies filled with zeros / one row. */
function completeDeclaration(): FormData {
  const data: FormData = {
    ...completeAnswers(),
    _scopeConfig: {
      vocationalTraining: {
        unemployedQualified: false, informalSector: false, vulnerable: false, scholarships: false,
        formerStudents: false, trainersWithDisability: false, completedAt: "2026-10-08",
      },
    },
  };
  for (const f of vt.sections.flatMap((s) => s.fields)) {
    const meta = f.table?.vt;
    if (!meta || !f.table?.matrix) continue;
    const rows = meta.progressiveRows || meta.isRoster ? f.table.matrix.slice(0, 1) : f.table.matrix;
    for (const rowIds of rows) {
      rowIds.forEach((id, c) => {
        const kind = meta.cells[c].kind;
        if (kind === "number") data[id] = "0";
        else if (kind === "text") data[id] = "Texte";
        else if (kind === "boolean") data[id] = false;
        else if (kind === "radioCode") data[id] = meta.cells[c].options?.[0]?.value ?? "1";
      });
    }
  }
  return data;
}

test("a complete training-centre declaration (questions, quiz, tables): no validation issue", () => {
  assert.deepEqual(validateEntityData(vt, completeDeclaration(), "fr"), []);
});

test("an unanswered required question is an issue, an empty tick list included", () => {
  const data = completeDeclaration();
  delete data.VT2_19;
  data.VT2_18 = [];
  const ids = validateEntityData(vt, data, "fr").map((i) => i.fieldId);
  assert.ok(ids.includes("VT2_19"));
  assert.ok(ids.includes("VT2_18"));
});

test("the agreed optional questions are never required", () => {
  for (const id of ["VT1_1", "VT1_3", "VT1_15_TEL2", "VT1_16_TEL2", "VT2_11", "VT2_11_CITY", "VT2_12", "VT2_13", "VT9_3"]) {
    assert.equal(field(id).required, false, id);
  }
});

test("a closed or non-functional centre only answers Section 1", () => {
  const section1 = Object.fromEntries(Object.entries(completeAnswers()).filter(([k]) => sectionOf(k) === "section1_vocationalTraining"));
  for (const status of ["Fermée/ Closed", "Non-fonctionnelle/ Non-functional"]) {
    const data: FormData = { ...section1, VT1_12: status, VT1_13: "Autres/ Others", VT1_13_OTHER: "Travaux" };
    assert.deepEqual(validateEntityData(vt, data, "fr"), [], status);
  }
});

test("VT1_13 follows the printed form: asked for Non-fonctionnelle only", () => {
  assert.equal(isFieldVisible(field("VT1_13"), { VT1_12: "Non-fonctionnelle/ Non-functional" }), true);
  assert.equal(isFieldVisible(field("VT1_13"), { VT1_12: "Fermée/ Closed" }), false);
});

test("switching a parent back to Non erases its follow-ups, down the chain", () => {
  const data: FormData = { VT3_1: "Non/ No", VT3_3: "Oui/ Yes", VT3_4: "3", VT6_1: "Non/ No", VT6_5: ["Autres/ Others"], VT6_6: "x" };
  const cleaned = cleanHiddenDependentFields(vt, data);
  for (const id of ["VT3_3", "VT3_4", "VT6_5", "VT6_6"]) assert.equal(cleaned[id], undefined, id);
});

test("section progress: optional questions left blank do not keep a section from being complete", async () => {
  const { isVtSectionComplete } = await import("@/components/onefop/vt-wizard-utils");
  const data = completeDeclaration();
  for (const id of ["VT1_3", "VT1_15_TEL2", "VT1_16_TEL2", "VT2_11", "VT2_11_CITY", "VT2_12", "VT2_13", "VT9_3"]) delete data[id];
  for (const section of vt.sections) assert.equal(isVtSectionComplete(section, data), true, section.id);
  delete data.VT2_19;
  assert.equal(isVtSectionComplete(vt.sections.find((s) => s.id === "section2_vocationalTraining")!, data), false);
});

test("section progress: a closed centre's Sections 2–9 count as complete", async () => {
  const { isVtSectionComplete } = await import("@/components/onefop/vt-wizard-utils");
  const data: FormData = { VT1_12: "Fermée/ Closed" };
  for (const section of vt.sections.filter((s) => s.id !== "section1_vocationalTraining")) {
    assert.equal(isVtSectionComplete(section, data), true, section.id);
  }
});
