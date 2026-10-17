import { test } from "node:test";
import assert from "node:assert/strict";
import { loadOnefopSchema, schemaEntity } from "@/test/schema";
import {
  detailAnswerValue,
  dossierEntity,
  dossierSections,
  fieldForDetailColumn,
  questionnaireAsks,
  sectionBackingTables,
} from "./dossier-sections";

const schema = loadOnefopSchema();

test("a file's entity is the one its formType names", () => {
  assert.equal(dossierEntity(schema, "PROJECT_PROGRAM")?.entityType, "projectProgram");
  assert.equal(dossierEntity(schema, "ENTREPRISE")?.entityType, "enterprise");
  assert.equal(dossierEntity(schema, "VOCATIONAL_TRAINING")?.entityType, "vocationalTraining");
  // An unknown formType shows no section rather than another type's.
  assert.equal(dossierEntity(schema, "DSMO"), null);
  assert.equal(dossierEntity(schema, null), null);
  assert.equal(dossierEntity(null, "ENTREPRISE"), null);
});

test("a project file lists the project questionnaire's own sections, not the enterprise ones", () => {
  const sections = dossierSections(schemaEntity("projectProgram"), "en");
  assert.deepEqual(
    sections.map((s) => s.id),
    ["section1_projectProgram", "section2_projectProgram", "section3_projectProgram", "section4_projectProgram"],
  );
  // The enterprise headings the page used to print on a project file.
  for (const title of sections.map((s) => s.title)) {
    assert.doesNotMatch(title, /Departures|Internship and training/);
  }
  assert.match(sections[1].title, /^Section 2\. Information on the structure under supervision/);
  assert.match(sections[2].titleFr, /^Section 3\. Emploi et travail\//);
});

test("Section 0 is not offered: the respondent's identity has its own card", () => {
  for (const type of ["enterprise", "cooperative", "ctd", "ong", "administration", "projectProgram"]) {
    assert.equal(
      dossierSections(schemaEntity(type), "fr").some((s) => s.id === "section0"),
      false,
      type,
    );
  }
});

test("the enterprise family's titles are the ones the correction comment already stored", () => {
  const fr = (type: string) => dossierSections(schemaEntity(type), "fr").map((s) => s.titleFr);
  assert.deepEqual(fr("enterprise"), [
    "Section 1. Identification de l'entreprise",
    "Section 2. Emploi et travail",
    "Section 3. Départs",
    "Section 4. Stage et formation",
  ]);
  // Acronyms keep their capitals, elided or not.
  assert.equal(fr("ctd")[0], "Section 1. Identification de la CTD");
  assert.equal(fr("ong")[0], "Section 1. Identification de l'ONG");
  assert.equal(dossierSections(schemaEntity("ctd"), "en")[0].title, "Section 1. RLA details");
  assert.equal(dossierSections(schemaEntity("ong"), "en")[0].title, "Section 1. NGO details");
});

test("VT keeps the nine sections the file page already showed", () => {
  const vt = dossierSections(schemaEntity("vocationalTraining"), "fr");
  assert.equal(vt.length, 9);
  assert.equal(vt[0].titleFr, "Section 1. Identification et localisation de la structure");
  assert.match(vt[5].titleFr, /MINEFOP/);
});

test("the backing tables named are the section's own, or none", () => {
  assert.match(sectionBackingTables("section3") ?? "", /departureData/);
  assert.equal(sectionBackingTables("section2_projectProgram"), "projectProgramActivities");
  // A section with no entry says nothing about tables rather than naming
  // another questionnaire's.
  assert.equal(sectionBackingTables("section7_vocationalTraining"), null);
});

test("a question the questionnaire does not ask is not shown as missing", () => {
  const pp = schemaEntity("projectProgram");
  assert.equal(questionnaireAsks(pp, "legalStatus"), false);
  assert.equal(questionnaireAsks(pp, "yearCreated"), false);
  assert.equal(questionnaireAsks(pp, "nature"), true);
  assert.equal(questionnaireAsks(schemaEntity("enterprise"), "legalStatus"), true);
  assert.equal(questionnaireAsks(schemaEntity("cooperative"), "yearCreated"), true);
  assert.equal(questionnaireAsks(schemaEntity("ong"), "yearCreated"), true);
});

test("a detail column reaches its question through the schema path, alias or not", () => {
  assert.equal(fieldForDetailColumn(schemaEntity("projectProgram"), "nature")?.id, "PP_S1Q01");
  assert.equal(fieldForDetailColumn(schemaEntity("enterprise"), "enterpriseSize")?.id, "S1Q12");
  assert.equal(fieldForDetailColumn(schemaEntity("cooperative"), "cooperativeType")?.id, "COOP_S1Q10");
  assert.equal(fieldForDetailColumn(schemaEntity("ctd"), "ctdType")?.id, "CTD_S1Q01");
  // No question fills it (the registered company name).
  assert.equal(fieldForDetailColumn(schemaEntity("enterprise"), "companyName"), null);
});

test("a coded answer reads as the option the respondent chose", () => {
  const pp = schemaEntity("projectProgram");
  // The code the submit normalizer stores (mapNature), 1-based on the AST's
  // own option list — what a reviewer saw as « Nature: 1 ».
  assert.equal(detailAnswerValue(pp, "nature", "1"), "Projet/ Project");
  assert.equal(detailAnswerValue(pp, "nature", "3"), "Structure sous-tutelle/ Structure under supervision");
  // The same row stores other answers as submitted; those pass through.
  assert.equal(detailAnswerValue(pp, "sector", "Tertiaire/ Tertiary"), "Tertiaire/ Tertiary");
  assert.equal(detailAnswerValue(schemaEntity("enterprise"), "enterpriseSize", "2"), "PE/ Small enterprise");
});

test("a value outside the option list, or a question without options, is left as stored", () => {
  const pp = schemaEntity("projectProgram");
  assert.equal(detailAnswerValue(pp, "nature", "9"), "9");
  assert.equal(detailAnswerValue(pp, "nature", "0"), "0");
  assert.equal(detailAnswerValue(pp, "nature", "Projet d'appui"), "Projet d'appui");
  assert.equal(detailAnswerValue(pp, "permanentWorkers", "12"), "12");
  assert.equal(detailAnswerValue(pp, "name", "12"), "12");
  assert.equal(detailAnswerValue(null, "nature", "1"), "1");
});
