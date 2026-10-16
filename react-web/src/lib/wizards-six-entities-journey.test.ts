import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopEntity, OnefopSchema } from "./onefop-schema";
import { validateEntityData } from "./onefop-validation";
import { prepareSubmissionData } from "./onefop-submission";
import { DEFAULT_SCOPE, type ScopeState } from "@/components/modern-jobs/scope/ScopeTypes";

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const schema = JSON.parse(
  readFileSync(join(root, "public", "schemas", "onefop.schema.json"), "utf-8"),
) as OnefopSchema;

function getEntity(name: string): OnefopEntity {
  const e = schema.entities[name];
  assert.ok(e, `Entity ${name} must exist in schema`);
  return e;
}

const validRespondent: FormData = {
  S0Q01: "Kamga Paul",
  S0Q02: "Directeur Général",
  S0Q03_TEL1: "699001122",
  S0Q03_EMAIL: "contact@organisation.cm",
};

/** All optional modules answered "No" in Preliminary Quiz */
const ALL_NO_SCOPE: ScopeState = {
  ...DEFAULT_SCOPE,
  applications: false,
  recruit: false,
  primo_seekers: false,
  primo_workers: false,
  departures: false,
  interns: false,
  skills_needs: false,
  training_needs: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENTERPRISE JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
test("Enterprise Journey: identification, quiz, workforce table, submit prep", () => {
  const ent = getEntity("enterprise");

  const entData: FormData = {
    ...validRespondent,
    S1Q01: "1", // Legal status
    S1Q02: "Entreprise Camerounaise SA",
    S1Q03: "1", // Area: Urban
    S1Q04_REGION: "Centre",
    S1Q04_DEPT: "Mfoundi",
    S1Q04_SUBDIV: "Yaoundé 1er",
    S1Q04_LOCALITY: "Bastos",
    S1Q05_TEL1: "699112233",
    S1Q05_BP: "BP 100",
    S1Q06: "1", // Sector: Primaire
    S1Q07: "Agroalimentaire",
    S1Q08: "Commercialisation de produits vivriers",
    S1Q09: "1", // Head office
    S1Q10: "2015", // Founding year
    S1Q11: "25", // Permanent workers
    S1Q12: "3", // Vacancies
    _scopeConfig: ALL_NO_SCOPE,
    S21Q01_RESPONSE_STATUS: "NONE",
  };

  // 1. Full validation passes (all tables NONE with zeroed cells)
  const issues = validateEntityData(ent, entData, "fr");
  assert.deepEqual(issues, [], "Enterprise complete declaration must have 0 validation issues");

  // 2. Omitting required identification field blocks validation
  const missingName = { ...entData, S1Q02: "" };
  const issuesMissingName = validateEntityData(ent, missingName, "fr");
  assert.ok(issuesMissingName.some((i) => i.fieldId === "S1Q02"));

  // 3. Prepare submission data zeroes inactive tables and derives status keys
  const out = prepareSubmissionData(ent, entData);
  assert.equal(out.S21Q01_RESPONSE_STATUS, "NONE");
  assert.equal(out.S3Q01_RESPONSE_STATUS, "NONE");
  assert.equal(out.S4Q01_RESPONSE_STATUS, "NONE");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. COOPERATIVE JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
test("Cooperative Journey: identification, quiz, workforce table, submit prep", () => {
  const coop = getEntity("cooperative");

  const coopData: FormData = {
    ...validRespondent,
    COOP_S1Q01: "Coopérative des Producteurs de Cacao",
    COOP_S1Q02: "Ebolowa", // Siège social
    COOP_S1Q03: "2018", // Founding year
    COOP_S1Q04: "2", // Rural
    COOP_S1Q05_REGION: "Sud",
    COOP_S1Q05_DEPT: "Mvila",
    COOP_S1Q05_SUBDIV: "Ebolowa 1er",
    COOP_S1Q05_LOCALITY: "Nko'ovos",
    COOP_S1Q06_TEL1: "677112233",
    COOP_S1Q06_BP: "BP 45",
    COOP_S1Q07: "1", // Sector: Primaire
    COOP_S1Q08: "Cacao",
    COOP_S1Q09: "Collecte et transformation du cacao",
    COOP_S1Q10: "Coopérative à comptabilité simplifiée", // Type
    COOP_S1Q11: "15", // Permanent workers
    COOP_S1Q12: "2", // Vacancies
    _scopeConfig: ALL_NO_SCOPE,
    S21Q01_RESPONSE_STATUS: "NONE",
  };

  const issues = validateEntityData(coop, coopData, "fr");
  assert.deepEqual(issues, [], "Cooperative complete declaration must have 0 validation issues");

  // Missing name (COOP_S1Q01) is flagged
  const missingName = { ...coopData, COOP_S1Q01: "" };
  assert.ok(validateEntityData(coop, missingName, "fr").some((i) => i.fieldId === "COOP_S1Q01"));

  const out = prepareSubmissionData(coop, coopData);
  assert.equal(out.S21Q01_RESPONSE_STATUS, "NONE");
  assert.equal(out.S3Q01_RESPONSE_STATUS, "NONE");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CTD JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
test("CTD Journey: identification, quiz, workforce table, submit prep", () => {
  const ctd = getEntity("ctd");

  const ctdData: FormData = {
    ...validRespondent,
    CTD_S1Q01: "Commune", // Type de CTD
    CTD_S1Q02: "Commune d'Arrondissement", // Type de commune
    CTD_S1Q03: "1996", // Année de création
    CTD_S1Q04: "1", // Urbain
    CTD_S1Q05_REGION: "Littoral",
    CTD_S1Q05_DEPT: "Wouri",
    CTD_S1Q05_SUBDIV: "Douala 1er",
    CTD_S1Q05_LOCALITY: "Bonanjo",
    CTD_S1Q06_TEL1: "699554433",
    CTD_S1Q06_BP: "BP 500",
    CTD_S1Q07: "3", // Tertiaire
    CTD_S1Q08: "Administration publique locale",
    CTD_S1Q09: "120", // Permanent workers
    CTD_S1Q10: "5", // Vacancies
    _scopeConfig: ALL_NO_SCOPE,
    S21Q01_RESPONSE_STATUS: "NONE",
  };

  const issues = validateEntityData(ctd, ctdData, "fr");
  assert.deepEqual(issues, [], "CTD complete declaration must have 0 validation issues");

  // Missing council type (CTD_S1Q01) is flagged
  const missingType = { ...ctdData, CTD_S1Q01: "" };
  assert.ok(validateEntityData(ctd, missingType, "fr").some((i) => i.fieldId === "CTD_S1Q01"));

  const out = prepareSubmissionData(ctd, ctdData);
  assert.equal(out.S21Q01_RESPONSE_STATUS, "NONE");
  assert.equal(out.S4Q02_RESPONSE_STATUS, "NONE");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. NGO (ONG) JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
test("NGO Journey: identification, quiz, workforce table, submit prep", () => {
  const ong = getEntity("ong");

  const ongData: FormData = {
    ...validRespondent,
    ONG_S1Q01: "Association pour le Développement Rural",
    ONG_S1Q02: "Bafoussam", // Siège social
    ONG_S1Q03: "2018", // Founding year
    ONG_S1Q04: "2", // Rural
    ONG_S1Q05_REGION: "Ouest",
    ONG_S1Q05_DEPT: "Mifi",
    ONG_S1Q05_SUBDIV: "Bafoussam 1er",
    ONG_S1Q05_LOCALITY: "Djeleng",
    ONG_S1Q06_TEL1: "677334455",
    ONG_S1Q06_BP: "BP 230",
    ONG_S1Q07: "3", // Tertiaire
    ONG_S1Q08: "Assistance humanitaire et formation",
    ONG_S1Q09: "Développement communautaire", // Mission principale
    ONG_S1Q10: "18", // Permanent workers
    ONG_S1Q11: "4", // Vacancies
    _scopeConfig: ALL_NO_SCOPE,
    S21Q01_RESPONSE_STATUS: "NONE",
  };

  const issues = validateEntityData(ong, ongData, "fr");
  assert.deepEqual(issues, [], "ONG complete declaration must have 0 validation issues");

  // Missing NGO name (ONG_S1Q01) is flagged
  const missingName = { ...ongData, ONG_S1Q01: "" };
  assert.ok(validateEntityData(ong, missingName, "fr").some((i) => i.fieldId === "ONG_S1Q01"));

  const out = prepareSubmissionData(ong, ongData);
  assert.equal(out.S21Q01_RESPONSE_STATUS, "NONE");
  assert.equal(out.S23Q02_RESPONSE_STATUS, "NONE");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PROJECT / PROGRAM JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
test("Project/Program Journey: mandatory sigle, section 2 activities guard, quiz & outcomes", () => {
  const pp = getEntity("projectProgram");

  const ppConfig = {
    completedAt: "2026-10-16T09:00:00.000Z",
    noOutcomes: false,
    outcomes: ["employed"],
    hasPermanentStaff: false,
    hasTemporaryStaff: false,
    hasRecruitment: false,
    recruitmentTypes: [],
  };

  const ppData: FormData = {
    ...validRespondent,
    PP_S1Q01: "Projet/ Project", // Nature: Projet
    PP_S1Q02: "Programme National de Développement Agricole",
    PP_S1Q03: "PNDA", // Mandatory sigle
    PP_S1Q04: "M. Le Coordonnateur",
    PP_S1Q05: "Urbain/ Urban", // Urbain
    PP_S1Q06_REGION: "Centre",
    PP_S1Q06_DEPT: "Mfoundi",
    PP_S1Q06_SUBDIV: "Yaoundé 2e",
    PP_S1Q06_LOCALITY: "Tsinga",
    PP_S1Q07_TEL1: "699887766",
    PP_S1Q07_BP: "BP 12",
    PP_S1Q08: "Primaire/ Primary", // Primaire
    PP_S1Q09: "Développement des filières vivrières",
    PP_S1Q10: "Coordination des projets agricoles",
    PP_S1Q11: "Yaoundé",
    PP_S1Q12: "MINADER",
    PP_S1Q13: "En cours/ In progress", // Status: En cours
    PP_S1Q15: "40", // Permanent workers
    PP_S1Q16: "6", // Vacancies
    _scopeConfig: { projectProgram: ppConfig },
    // Section 4 table statuses (as written by ProjectProgramScopeQuiz)
    S4Q01_RESPONSE_STATUS: "NONE",
    PP_S4Q01_RESPONSE_STATUS: "NONE",
    S4Q02_RESPONSE_STATUS: "NONE",
    PP_S4Q02_RESPONSE_STATUS: "NONE",
    S4Q03_RESPONSE_STATUS: "NONE",
    PP_S4Q03_RESPONSE_STATUS: "NONE",
    S4Q04_RESPONSE_STATUS: "NONE",
    PP_S4Q04_RESPONSE_STATUS: "NONE",
    S4Q05_RESPONSE_STATUS: "NONE",
    PP_S4Q05_RESPONSE_STATUS: "NONE",
    S4Q06_RESPONSE_STATUS: "NONE",
    PP_S4Q06_RESPONSE_STATUS: "NONE",
    // Section 2: One complete activity
    s2_row1_description: "Appui aux groupements paysans",
    s2_row1_targetPopulation: "4", // Rural
    s2_row1_supportType: "1", // Gratuit
    s2_row1_scope: "2", // Régional
    s2_row1_startDate: "01/2026",
    s2_row1_duration: "12",
    // Section 3: Outcomes
    s3kpi_employed_current: 50,
    s3kpi_employed_outlook_dec: 100,
    s3kpi_employed_outlook_june: 150,
  };

  // 1. Full validation passes
  const issues = validateEntityData(pp, ppData, "fr");
  assert.deepEqual(issues, [], "Project/Program complete declaration must have 0 validation issues");

  // 2. Omitting mandatory sigle (PP_S1Q03) produces a blocking validation issue
  const missingSigle = { ...ppData, PP_S1Q03: "" };
  assert.ok(validateEntityData(pp, missingSigle, "fr").some((i) => i.fieldId === "PP_S1Q03"));

  // 3. Status = 'En arrêt/ Stopped' without stopReason (PP_S1Q14) produces a blocking validation issue
  const stoppedWithoutReason = { ...ppData, PP_S1Q13: "En arrêt/ Stopped", PP_S1Q14: "" };
  assert.ok(validateEntityData(pp, stoppedWithoutReason, "fr").some((i) => i.fieldId === "PP_S1Q14"));

  // 4. Partially started row in Section 2 (Activities) produces blocking issues
  const partialActivity = { ...ppData, s2_row2_description: "Activité orpheline" };
  const issuesPartial = validateEntityData(pp, partialActivity, "fr");
  assert.ok(issuesPartial.some((i) => i.fieldId === "s2_row2_targetPopulation"));
  assert.ok(issuesPartial.some((i) => i.fieldId === "s2_row2_duration"));

  // 5. Prepare submission data preserves forecast columns for unselected outcomes
  const out = prepareSubmissionData(pp, ppData);
  assert.equal(out.s3kpi_employed_current, 50);
  assert.equal(out.s3kpi_self_employed_current, 0, "unselected outcome current achievement is zeroed");
  assert.equal(out.S4Q01_RESPONSE_STATUS, "NONE");
  assert.equal(out.S4Q02_RESPONSE_STATUS, "NONE");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ADMINISTRATION JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
test("Administration Journey: mandatory sigle, poBox, branch, conditional counts, census forced", () => {
  const admin = getEntity("administration");

  const adminScope: ScopeState = {
    ...ALL_NO_SCOPE,
    applications: null,
  };

  const adminData: FormData = {
    ...validRespondent,
    ADMIN_S1Q01: "Ministère de l'Emploi et de la Formation Professionnelle",
    ADMIN_S1Q02: "MINEFOP", // Mandatory sigle
    ADMIN_S1Q03: "1", // Urbain
    ADMIN_S1Q04_REGION: "Centre",
    ADMIN_S1Q04_DEPT: "Mfoundi",
    ADMIN_S1Q04_SUBDIV: "Yaoundé 1er",
    ADMIN_S1Q04_LOCALITY: "Centre Administratif",
    ADMIN_S1Q05_TEL1: "699000000",
    ADMIN_S1Q05_BP: "BP 1050", // Mandatory poBox
    ADMIN_S1Q06: "3", // Tertiaire
    ADMIN_S1Q07: "Administration Centrale", // Mandatory branch
    ADMIN_S1Q08: "Conception et mise en oeuvre de la politique d'emploi",
    ADMIN_S1Q09: "Oui/ Yes", // hasProject: Oui
    ADMIN_S1Q10: "3", // projectCount
    ADMIN_S1Q11: "Non/ No", // hasSupervisedStructures: Non
    _scopeConfig: adminScope,
    S21Q01_RESPONSE_STATUS: "REPORTED",
  };

  // Administration S21Q01 census is always reported
  const s21q01 = admin.sections.flatMap((s) => s.fields).find((f) => f.id === "S21Q01");
  assert.ok(s21q01?.table?.matrix);
  for (const cellId of s21q01.table.matrix.flat()) {
    adminData[cellId] = "0";
  }

  // 1. Full validation passes
  const issues = validateEntityData(admin, adminData, "fr");
  assert.deepEqual(issues, [], "Administration complete declaration must have 0 validation issues");

  // 2. Omitting mandatory sigle (ADMIN_S1Q02) produces a blocking validation issue
  const missingSigle = { ...adminData, ADMIN_S1Q02: "" };
  assert.ok(validateEntityData(admin, missingSigle, "fr").some((i) => i.fieldId === "ADMIN_S1Q02"));

  // 3. Omitting mandatory poBox (ADMIN_S1Q05_BP) produces a blocking validation issue
  const missingPoBox = { ...adminData, ADMIN_S1Q05_BP: "" };
  assert.ok(validateEntityData(admin, missingPoBox, "fr").some((i) => i.fieldId === "ADMIN_S1Q05_BP"));

  // 4. Omitting mandatory branch (ADMIN_S1Q07) produces a blocking validation issue
  const missingBranch = { ...adminData, ADMIN_S1Q07: "" };
  assert.ok(validateEntityData(admin, missingBranch, "fr").some((i) => i.fieldId === "ADMIN_S1Q07"));

  // 5. hasProject: 'Oui/ Yes' without projectCount (ADMIN_S1Q10) produces a blocking validation issue
  const missingProjectCount = { ...adminData, ADMIN_S1Q10: "" };
  assert.ok(validateEntityData(admin, missingProjectCount, "fr").some((i) => i.fieldId === "ADMIN_S1Q10"));

  // 6. hasSupervisedStructures: 'Oui/ Yes' without count (ADMIN_S1Q12) produces a blocking validation issue
  const missingSupervisedCount = { ...adminData, ADMIN_S1Q11: "Oui/ Yes", ADMIN_S1Q12: "" };
  assert.ok(validateEntityData(admin, missingSupervisedCount, "fr").some((i) => i.fieldId === "ADMIN_S1Q12"));

  // 7. Prepare submission data forces S21Q01 to REPORTED
  const out = prepareSubmissionData(admin, adminData);
  assert.equal(out.S21Q01_RESPONSE_STATUS, "REPORTED", "Administration census is always forced to REPORTED");
});
