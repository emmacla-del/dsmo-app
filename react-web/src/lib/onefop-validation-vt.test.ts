import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanHiddenDependentFields, isFieldVisible, type FormData, type OnefopSchema } from "./onefop-schema";
import { validateEntityData, validateSectionData, vtSubsetIssues } from "./onefop-validation";
import { vtCrossTableIssues } from "./vt-cross-table";

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
    if (f.id === "VT1_14" || f.id === "VT2_15") out[f.id] = "2010";
    else if (f.id === "VT2_17") out[f.id] = "15/03/2019";
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

test("an empty always-applicable table asks for a row without citing the quiz", () => {
  const data = completeDeclaration();
  for (const id of field("VT8_8").table!.matrix!.flat()) delete data[id];
  const issue = validateEntityData(vt, data, "fr").find((i) => i.fieldId === "VT8_8");
  assert.ok(issue, "the empty roster is an issue");
  assert.match(issue.message, /Ajoutez au moins une ligne$/);
});

test("an empty table the quiz answered Oui says the row is owed to that answer", () => {
  const data = completeDeclaration();
  (data._scopeConfig as { vocationalTraining: Record<string, unknown> }).vocationalTraining.unemployedQualified = true;
  for (const id of field("VT4_3").table!.matrix!.flat()) delete data[id];
  const issue = validateEntityData(vt, data, "fr").find((i) => i.fieldId === "VT4_3");
  assert.ok(issue, "4.3 answered Oui with no row is an issue");
  assert.match(issue.message, /Ajoutez au moins une ligne \(réponse « Oui » au questionnaire préliminaire\)$/);
});

// ── Cross-table coherence (vt-cross-table.ts): same people, same totals ──

const section4 = vt.sections.find((s) => s.id === "section4_vocationalTraining")!;
const section8 = vt.sections.find((s) => s.id === "section8_vocationalTraining")!;
const crossIssue = (issues: { fieldId: string; message: string }[], fieldId: string) =>
  issues.find((i) => i.fieldId === fieldId && /concordent/.test(i.message));

test("4.2 disagreeing with 4.1 blocks Section 4 and submission, on 4.2, naming both sexes", () => {
  const data = completeDeclaration();
  data.s4q1_bepc_male = "25"; data.s4q1_bepc_female = "20";
  data.s4q2_cap_male = "20"; data.s4q2_cap_female = "25";
  const issue = crossIssue(validateSectionData(section4, data, "fr"), "VT4_2");
  assert.ok(issue, "Section 4 cannot be left");
  assert.match(issue.message, /Le tableau 4\.2 compte 20 hommes et 25 femmes, mais le tableau 4\.1 en compte 25 hommes et 20 femmes/);
  assert.ok(crossIssue(validateEntityData(vt, data, "fr"), "VT4_2"), "submission is blocked too");
});

test("tables that agree raise no cross-table issue", () => {
  const data = completeDeclaration();
  data.s4q1_bepc_male = "25"; data.s4q1_bepc_female = "20";
  data.s4q2_cap_male = "25"; data.s4q2_cap_female = "20";
  data.s4q5_row1_fiMale = "20"; data.s4q5_row1_fcMale = "5"; data.s4q5_row1_fiFemale = "20";
  data.s4q6_row1_year1Male = "12"; data.s4q6_row1_year2Male = "8"; data.s4q6_row1_year1Female = "20";
  assert.deepEqual(validateSectionData(section4, data, "fr"), []);
});

test("4.5 is checked against 4.2, and 4.6 against the initial-training part of 4.5", () => {
  const data = completeDeclaration();
  data.s4q1_bepc_male = "25"; data.s4q2_cap_male = "25";
  data.s4q5_row1_fiMale = "20"; data.s4q5_row1_fcMale = "4";
  data.s4q6_row1_year1Male = "19";
  const issues = validateSectionData(section4, data, "fr");
  assert.match(crossIssue(issues, "VT4_5")!.message, /4\.5 compte 24 hommes, mais le tableau 4\.2 en compte 25/);
  assert.match(crossIssue(issues, "VT4_6")!.message, /4\.6 compte 19 hommes, mais le tableau 4\.5 \(FI\) en compte 20/);
});

test("a table still being filled is not compared yet: only its missing cells are reported", () => {
  const data = completeDeclaration();
  data.s4q1_bepc_male = "25";
  delete data.s4q2_cap_male;
  const issues = validateSectionData(section4, data, "fr");
  assert.equal(crossIssue(issues, "VT4_2"), undefined);
  assert.ok(issues.some((i) => i.fieldId === "VT4_2"), "the missing cell is still reported");
});

test("trainers: 8.2, 8.3 and 8.5 are each checked against 8.1", () => {
  const data = completeDeclaration();
  data.s8q1_licence_male = "5";
  data.s8q2_bts_hnd_male = "4";
  data.s8q3_age_25_39_male = "5";
  data.VT8_5_PERM_M = "6";
  const issues = validateSectionData(section8, data, "fr");
  assert.match(crossIssue(issues, "VT8_2")!.message, /8\.2 compte 4 hommes, mais le tableau 8\.1 en compte 5/);
  assert.equal(crossIssue(issues, "VT8_3"), undefined);
  assert.match(crossIssue(issues, "VT8_5_VP_M")!.message, /8\.5 compte 6 hommes, mais le tableau 8\.1 en compte 5/);
});

test("comparisons of different populations (4.2 against 4.7 entrants) do not block", () => {
  const data = completeDeclaration();
  (data._scopeConfig as { vocationalTraining: Record<string, unknown> }).vocationalTraining.formerStudents = false;
  data.s4q1_bepc_male = "25"; data.s4q2_cap_male = "25";
  data.s4q5_row1_fiMale = "25"; data.s4q6_row1_year1Male = "25";
  data.s4q7_age_18_entrant_male = "3";
  assert.deepEqual(validateSectionData(section4, data, "fr"), []);
});

test("each mismatch names both of its tables, so the screen can offer to open either", () => {
  const data = completeDeclaration();
  data.s4q1_bepc_male = "25"; data.s4q2_cap_male = "25";
  data.s4q5_row1_fiMale = "20"; data.s4q5_row1_fcMale = "4";
  data.s4q6_row1_year1Male = "19";
  const issues = vtCrossTableIssues(section4.fields, data);
  assert.deepEqual(
    issues.map((i) => [i.fieldId, i.tables.map((tb) => `${tb.code}/${tb.fieldId}`)]),
    [
      ["VT4_5", ["4.2/VT4_2", "4.5/VT4_5"]],
      // "4.5 (FI)" names the part compared; a link to the table says 4.5.
      ["VT4_6", ["4.5/VT4_5", "4.6/VT4_6"]],
    ],
  );
});

// ── Table messages follow the cells that are missing (audit R6) ──────────

test("a table of Yes/No answers is not told to enter 0 (5.2)", () => {
  const data = completeDeclaration();
  // One row started by its specialty: the two Yes/No answers are owed.
  for (const id of field("VT5_5").table!.matrix!.flat()) delete data[id];
  data.s5q2_row1_specialtyText = "Couture";
  const issue = validateSectionData(vt.sections.find((s) => s.id === sectionOf("VT5_5"))!, data, "fr")
    .find((i) => i.fieldId === "VT5_5");
  assert.ok(issue);
  assert.match(issue.message, /1 réponse reste à renseigner\.$/, "the second answer waits for the first to be Oui");
  assert.doesNotMatch(issue.message, /0/, "nothing to count, nothing to enter 0 in");
});

test("a table of counts still advises entering 0 (4.2)", () => {
  const data = completeDeclaration();
  delete data.s4q2_cap_male;
  const issue = validateSectionData(section4, data, "fr").find((i) => i.fieldId === "VT4_2");
  assert.ok(issue);
  assert.match(issue.message, /1 cellule reste à renseigner\. Saisissez 0 lorsqu'il n'y a rien à déclarer\.$/);
});

test("a row owing both a specialty and counts advises 0 for the counts only (4.3)", () => {
  const data = completeDeclaration();
  (data._scopeConfig as { vocationalTraining: Record<string, unknown> }).vocationalTraining.unemployedQualified = true;
  for (const id of field("VT4_3").table!.matrix!.flat()) delete data[id];
  data.s4q3_row1_fiMale = "2";
  const issue = validateSectionData(section4, data, "fr").find((i) => i.fieldId === "VT4_3");
  assert.ok(issue);
  assert.match(issue.message, /Saisissez 0 dans les effectifs lorsqu'il n'y a rien à déclarer\.$/);
});

test("the trainers' list asks for answers, not cells to put 0 in (8.8)", () => {
  const data = completeDeclaration();
  for (const id of field("VT8_8").table!.matrix!.flat()) delete data[id];
  data.s8q8_row1_lastName = "Nkolo";
  const issue = validateSectionData(section8, data, "fr").find((i) => i.fieldId === "VT8_8");
  assert.ok(issue);
  assert.match(issue.message, /réponses? (reste|restent) à renseigner/);
});

// ── Defect 5: Impossible "of which" (dont) values (Decision 3: warn on entry, block on submit) ──

const section2 = vt.sections.find((s) => s.id === "section2_vocationalTraining")!;
const section3 = vt.sections.find((s) => s.id === "section3_vocationalTraining")!;
const section6 = vt.sections.find((s) => s.id === "section6_vocationalTraining")!;

test("Defect 5: 2.1.7 female specialized teachers > total warns on entry and blocks section/submission", () => {
  const data = completeDeclaration();
  data.VT2_7 = "3";
  data.VT2_8 = "5"; // 5 > 3
  const issues = vtSubsetIssues(section2.fields, data, "fr");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].fieldId, "VT2_8");
  assert.match(issues[0].message, /Le nombre de femmes \(5\) ne peut pas dépasser le total des formateurs spécialisés \(3\)/);

  // Blocks section navigation
  const secIssues = validateSectionData(section2, data, "fr");
  assert.ok(secIssues.some((i) => i.fieldId === "VT2_8"));

  // Blocks final submit
  const entityIssues = validateEntityData(vt, data, "fr");
  assert.ok(entityIssues.some((i) => i.fieldId === "VT2_8"));
});

test("Defect 5: 2.1.16 secondary trainees sum > 2.1.15 total trainees warns and blocks", () => {
  const data = completeDeclaration();
  data.VT2_19 = "50";
  data.VT2_21 = "20";
  data.VT2_22 = "40"; // 20 + 40 = 60 > 50
  const issues = vtSubsetIssues(section2.fields, data, "fr");
  assert.ok(issues.some((i) => i.fieldId === "VT2_22"));

  const secIssues = validateSectionData(section2, data, "fr");
  assert.ok(secIssues.some((i) => i.fieldId === "VT2_22"));
});

test("Defect 5: 2.2.15 ICT trained female teachers > total warns and blocks", () => {
  const data = completeDeclaration();
  data.VT2_47 = "4";
  data.VT2_48 = "6"; // 6 > 4
  const issues = vtSubsetIssues(section2.fields, data, "fr");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].fieldId, "VT2_48");
});

test("Defect 5: Section 3 trained teachers sum > VT2_20 total teachers warns and blocks", () => {
  const data = completeDeclaration();
  data.VT2_20 = "10";
  data.VT3_13 = "6";
  data.VT3_14 = "5"; // 6 + 5 = 11 > 10
  const issues = vtSubsetIssues(section3.fields, data, "fr");
  assert.ok(issues.some((i) => i.fieldId === "VT3_14"));

  const secIssues = validateSectionData(section3, data, "fr");
  assert.ok(secIssues.some((i) => i.fieldId === "VT3_14"));
});

test("Defect 5: 6.3 placed leavers in a specialty > 4.10 leavers warns and blocks", () => {
  const data = completeDeclaration();
  data.s4q10_row1_specialtyText = "Couture et mode";
  data.s4q10_row1_male = "2";
  data.s4q10_row1_female = "4";

  data.s6q3_row1_specialtyText = "Couture et mode";
  data.s6q3_row1_male = "1";
  data.s6q3_row1_female = "5"; // 5 > 4 placed women > leavers

  const issues = vtSubsetIssues(section6.fields, data, "fr");
  assert.ok(issues.some((i) => i.fieldId === "VT6_13" && /Couture et mode/.test(i.message)));

  const secIssues = validateSectionData(section6, data, "fr");
  assert.ok(secIssues.some((i) => i.fieldId === "VT6_13"));
});


// Defect 18 (2026-10-16 run): 2.1.13's order date is free text stored as
// DD/MM/YYYY; the format is now checked, the stored text unchanged.
test("2.1.13's accreditation order date must be a real DD/MM/YYYY date, not in the future", async () => {
  const { isValidDayMonthYear } = await import("./onefop-validation");
  const today = new Date(2026, 9, 16);
  assert.equal(isValidDayMonthYear("15/03/2019", today), true);
  assert.equal(isValidDayMonthYear("16/10/2026", today), true);
  for (const bad of ["2019-03-15", "15/3/2019", "31/02/2019", "15/13/2019", "17/10/2026", "01/01/1899", "15/03/2019 "]) {
    assert.equal(isValidDayMonthYear(bad, today), false, bad);
  }
  const data: FormData = { VT2_14: "Oui/ Yes", VT2_17: "2019-03-15" };
  const issues = validateSectionData(vt.sections.find((s: { id: string }) => s.id === sectionOf("VT2_17"))!, data, "en");
  const issue = issues.find((i) => i.fieldId === "VT2_17");
  assert.match(issue?.cleanMessage ?? "", /DD\/MM\/YYYY/);
  const ok = validateSectionData(vt.sections.find((s: { id: string }) => s.id === sectionOf("VT2_17"))!, { ...data, VT2_17: "15/03/2019" }, "en");
  assert.equal(ok.find((i) => i.fieldId === "VT2_17"), undefined);
});
