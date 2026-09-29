import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load compiled ONEFOP schema
const schemaPath = path.join(__dirname, "../public/schemas/onefop.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
const enterprise = schema.entities.enterprise;

import { register } from "node:module";
register("./ts-resolver.mjs", import.meta.url);

const { validateEntityData } = await import("../src/lib/onefop-validation.ts");
const { missingQuizFieldKeys, quizGovernsEntry } = await import("../src/components/onefop/tables/quizRequired.ts");
const { getModernJobsTableDefinition, getGuidedOnlyTableDefinition } = await import("../src/components/onefop/tables/definitions/modernJobsTableDefinitions.ts");

test("quizGovernsEntry detects presence of _scopeConfig", () => {
  assert.equal(quizGovernsEntry({}), false);
  assert.equal(quizGovernsEntry({ _scopeConfig: null }), false);
  assert.equal(quizGovernsEntry({ _scopeConfig: {} }), true);
  assert.equal(quizGovernsEntry({ _scopeConfig: { recruit: true } }), true);
});

test("Pre-questionnaire retained table cells become strictly required", () => {
  // Base identification fields filled so section 0 and 1 don't distract
  const baseData = {
    S0Q01: "John Doe",
    S0Q02: "Manager",
    S0Q03_TEL1: "699112233",
    S0Q03_EMAIL: "john@example.com",
    S1Q01: "SARL/ LLC",
    S1Q02: "ACME Corp",
    S1Q03: "Urbain/ Urban",
    S1Q04_REGION: "CENTRE",
    S1Q04_DEPT: "MFOUNDI",
    S1Q04_SUBDIV: "YAOUNDE 1",
    S1Q04_LOCALITY: "Bastos",
    S1Q05_TEL1: "677112233",
    S1Q06: "Tertiaire/ Tertiary",
    S1Q07: "Commerce",
    S1Q08: "Vente en gros",
    S1Q09: "Yaoundé",
    S1Q10: "25",
    S1Q11: "2",
    S1Q12: "PE/ Small enterprise",
  };

  // 1. Without _scopeConfig, tables are not governed by quizRequired
  const issuesBeforeQuiz = validateEntityData(enterprise, baseData, "fr");
  const s21IssuesBefore = issuesBeforeQuiz.filter((i) => i.fieldId === "S21Q01");
  // Before quiz, S21Q01 has no RESPONSE_STATUS so it's not reported
  assert.equal(s21IssuesBefore.length, 0);

  // 2. Pre-questionnaire answered:
  // applications = true, Cadres only, 15-24 age group only
  const scopeConfig = {
    applications: true,
    application_csp: ["cadres"],
    application_age: ["15_24"],
    recruit: false,
    primo_seekers: false,
    primo_workers: false,
    departures: false,
    interns: false,
    skills_needs: false,
    training_needs: false,
  };

  const dataWithQuiz = {
    ...baseData,
    _scopeConfig: scopeConfig,
    S21Q01_RESPONSE_STATUS: "REPORTED",
    S22Q01_RESPONSE_STATUS: "NONE",
    S22Q02_RESPONSE_STATUS: "NONE",
    S22Q03_RESPONSE_STATUS: "NONE",
    S22Q04_RESPONSE_STATUS: "NONE",
    S22Q05_RESPONSE_STATUS: "NONE",
    S22Q05_ENTERPRISE_RESPONSE_STATUS: "NONE",
    S23Q01_RESPONSE_STATUS: "NONE",
    S23Q02_RESPONSE_STATUS: "NONE",
    S3Q01_RESPONSE_STATUS: "NONE",
    S3Q02_RESPONSE_STATUS: "NONE",
    S3Q03_RESPONSE_STATUS: "NONE",
    S4Q01_RESPONSE_STATUS: "NONE",
    S4Q02_RESPONSE_STATUS: "NONE",
    S4Q03_RESPONSE_STATUS: "NONE",
  };

  // S21Q01 is reported, but cells are empty!
  const issuesAfterQuizEmpty = validateEntityData(enterprise, dataWithQuiz, "fr");
  const s21Issue = issuesAfterQuizEmpty.find((i) => i.fieldId === "S21Q01");
  assert.ok(s21Issue, "S21Q01 must be flagged as having required missing cells");
  assert.match(s21Issue.message, /cellule\(s\) ou option\(s\) obligatoire\(s\) non renseignée\(s\)/);

  // S22Q01 was declared NONE, so it must NOT produce an issue
  assert.equal(issuesAfterQuizEmpty.some((i) => i.fieldId === "S22Q01"), false);

  // 3. User fills in the 2 retained cells for Cadres 15-24 (even with 0)
  const dataWithCellsFilled = {
    ...dataWithQuiz,
    s21q01_cadres_male_15_24: 0,
    s21q01_cadres_female_15_24: 3,
  };

  const issuesAfterCellsFilled = validateEntityData(enterprise, dataWithCellsFilled, "fr");
  const s21IssueFilled = issuesAfterCellsFilled.find((i) => i.fieldId === "S21Q01");
  assert.equal(s21IssueFilled, undefined, "S21Q01 issue must be resolved once all retained cells are entered");
});

test("S4Q02 priority skills require text and counts when reported", () => {
  const scopeConfig = {
    applications: false,
    recruit: false,
    primo_seekers: false,
    primo_workers: false,
    departures: false,
    interns: false,
    skills_needs: true,
    training_needs: false,
  };

  const data = {
    _scopeConfig: scopeConfig,
    S4Q02_RESPONSE_STATUS: "REPORTED",
  };

  const s4q02Field = enterprise.sections
    .flatMap((s) => s.fields)
    .find((f) => f.id === "S4Q02" || (f.paperCode && f.paperCode === "S4Q02"));
  assert.ok(s4q02Field);

  const def = getGuidedOnlyTableDefinition(s4q02Field, data);
  assert.ok(def);

  // When empty: row 1 text, male, female are missing
  const missingEmpty = missingQuizFieldKeys(def, data);
  assert.ok(missingEmpty.includes("s4q02_skill_1_male"));
  assert.ok(missingEmpty.includes("s4q02_skill_1_female"));
  assert.ok(missingEmpty.includes("S4Q02_DOMAIN_1_TEXT"));

  // Fill Row 1
  const dataFilled = {
    ...data,
    S4Q02_DOMAIN_1_TEXT: "Développement web",
    s4q02_skill_1_male: 2,
    s4q02_skill_1_female: 1,
  };

  const missingFilled = missingQuizFieldKeys(def, dataFilled);
  assert.equal(missingFilled.length, 0, "Row 1 completed, Row 2 and 3 untouched -> passes");

  // If user starts typing text in Row 2 but leaves numbers empty:
  const dataPartialRow2 = {
    ...dataFilled,
    S4Q02_DOMAIN_2_TEXT: "Comptabilité",
  };
  const missingPartial = missingQuizFieldKeys(def, dataPartialRow2);
  assert.ok(missingPartial.includes("s4q02_skill_2_male"));
  assert.ok(missingPartial.includes("s4q02_skill_2_female"));
});

test("S4Q01 internships require retained internship types", () => {
  const scopeConfig = {
    interns: true,
    intern_types: ["academique", "professionnel"],
  };

  const data = {
    _scopeConfig: scopeConfig,
    S4Q01_RESPONSE_STATUS: "REPORTED",
  };

  const s4q01Field = enterprise.sections
    .flatMap((s) => s.fields)
    .find((f) => f.id === "S4Q01" || (f.paperCode && f.paperCode === "S4Q01"));
  assert.ok(s4q01Field);

  const def = getModernJobsTableDefinition(s4q01Field, data);
  assert.ok(def);

  // 2 retained rows (academic, professional) x 2 genders (M, F) = 4 missing cells
  const missing = missingQuizFieldKeys(def, data);
  assert.equal(missing.length, 4);

  // Fill all 4
  const dataFilled = {
    ...data,
    s4q01_academic_male: 1,
    s4q01_academic_female: 2,
    s4q01_professional_male: 0,
    s4q01_professional_female: 0,
  };

  const missingFilled = missingQuizFieldKeys(def, dataFilled);
  assert.equal(missingFilled.length, 0);
});
