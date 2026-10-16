import test from "node:test";
import assert from "node:assert/strict";
import type { FormData } from "./onefop-schema";
import { validateEntityData, validateSectionData } from "./onefop-validation";
import { schemaEntity } from "@/test/schema";

// Enterprise entity has S3Q02 (reasons), S4Q01 (internships), S4Q02 (skills), S4Q03 (training)
const ent = schemaEntity("enterprise");
const entSection3 = ent.sections.find((s) => s.id === "section3")!;
const entSection4 = ent.sections.find((s) => s.id === "section4")!;

test("S3Q02: row 2 count entered requires reason description (FR & EN)", () => {
  const data: FormData = {
    _scopeConfig: { departures: true, departure_reasons: ["licenciement"] },
    S3Q02_RESPONSE_STATUS: "REPORTED",
    s3q02_reason_1_male: 1,
    s3q02_reason_1_female: 0,
    S3Q02_REASON_1_TEXT: "Fin de contrat",
    // Row 2 started with count, but no text
    s3q02_reason_2_male: 3,
    s3q02_reason_2_female: 0,
    S3Q02_REASON_2_TEXT: "",
  };

  // Section-level validation
  const issuesFr = validateSectionData(entSection3, data, "fr");
  const issueFr = issuesFr.find((i) => i.fieldId === "S3Q02_REASON_2_TEXT");
  assert.ok(issueFr, "Section validation must flag S3Q02_REASON_2_TEXT");
  assert.equal(
    issueFr?.message,
    "La description du motif est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
  );

  const issuesEn = validateSectionData(entSection3, data, "en");
  const issueEn = issuesEn.find((i) => i.fieldId === "S3Q02_REASON_2_TEXT");
  assert.ok(issueEn);
  assert.equal(
    issueEn?.message,
    "Dismissal reason description is required when a count is entered for this row.",
  );

  // Entity-level validation
  const entIssues = validateEntityData(ent, data, "fr");
  assert.ok(entIssues.some((i) => i.fieldId === "S3Q02_REASON_2_TEXT"));
});

test("S3Q02: row 2 text entered requires headcounts", () => {
  const data: FormData = {
    _scopeConfig: { departures: true, departure_reasons: ["licenciement"] },
    S3Q02_RESPONSE_STATUS: "REPORTED",
    s3q02_reason_1_male: 1,
    s3q02_reason_1_female: 0,
    S3Q02_REASON_1_TEXT: "Fin de contrat",
    // Row 2 started with text, but count is 0 / empty
    S3Q02_REASON_2_TEXT: "Faute lourde",
    s3q02_reason_2_male: 0,
    s3q02_reason_2_female: 0,
  };

  const issuesFr = validateSectionData(entSection3, data, "fr");
  assert.ok(
    issuesFr.some((i) => i.message.includes("Les effectifs sont obligatoires pour ce motif")),
  );

  const issuesEn = validateSectionData(entSection3, data, "en");
  assert.ok(
    issuesEn.some((i) => i.message.includes("Headcounts are required for this dismissal reason")),
  );
});

test("S3Q02: complete slot 2 passes cleanly", () => {
  const data: FormData = {
    _scopeConfig: { departures: true, departure_reasons: ["licenciement"] },
    S3Q02_RESPONSE_STATUS: "REPORTED",
    s3q02_reason_1_male: 1,
    s3q02_reason_1_female: 0,
    S3Q02_REASON_1_TEXT: "Fin de contrat",
    S3Q02_REASON_2_TEXT: "Faute lourde",
    s3q02_reason_2_male: 2,
    s3q02_reason_2_female: 0,
  };

  const issues = validateSectionData(entSection3, data, "fr");
  const s3q02Issues = issues.filter((i) => i.fieldId.startsWith("S3Q02") || i.fieldId.startsWith("s3q02"));
  assert.equal(s3q02Issues.length, 0);
});

test("S3Q02: gated out by quiz (departures: false) ignores stale draft row 2", () => {
  const data: FormData = {
    _scopeConfig: { departures: false },
    s3q02_reason_2_male: 5,
    S3Q02_REASON_2_TEXT: "",
  };

  const issues = validateSectionData(entSection3, data, "fr");
  assert.equal(issues.filter((i) => i.fieldId === "S3Q02_REASON_2_TEXT").length, 0);
});

test("S4Q02: row 2 or 3 count entered requires skill domain description (FR & EN)", () => {
  const data: FormData = {
    _scopeConfig: { skills_needs: true },
    S4Q02_RESPONSE_STATUS: "REPORTED",
    s4q02_skill_1_male: 2,
    s4q02_skill_1_female: 1,
    S4Q02_DOMAIN_1_TEXT: "Gestion",
    // Row 2 count entered without text
    s4q02_skill_2_male: 3,
    s4q02_skill_2_female: 0,
    S4Q02_DOMAIN_2_TEXT: "",
    // Row 3 count entered without text
    s4q02_skill_3_male: 0,
    s4q02_skill_3_female: 4,
    S4Q02_DOMAIN_3_TEXT: "",
  };

  const issuesFr = validateSectionData(entSection4, data, "fr");
  const r2Fr = issuesFr.find((i) => i.fieldId === "S4Q02_DOMAIN_2_TEXT");
  const r3Fr = issuesFr.find((i) => i.fieldId === "S4Q02_DOMAIN_3_TEXT");
  assert.ok(r2Fr, "Must flag S4Q02_DOMAIN_2_TEXT");
  assert.ok(r3Fr, "Must flag S4Q02_DOMAIN_3_TEXT");
  assert.equal(
    r2Fr?.message,
    "Le domaine de compétence est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
  );

  const issuesEn = validateSectionData(entSection4, data, "en");
  const r2En = issuesEn.find((i) => i.fieldId === "S4Q02_DOMAIN_2_TEXT");
  assert.equal(
    r2En?.message,
    "Skill domain description is required when a count is entered for this row.",
  );
});

test("S4Q02: text entered requires headcounts", () => {
  const data: FormData = {
    _scopeConfig: { skills_needs: true },
    S4Q02_RESPONSE_STATUS: "REPORTED",
    s4q02_skill_1_male: 2,
    s4q02_skill_1_female: 1,
    S4Q02_DOMAIN_1_TEXT: "Gestion",
    // Row 2 text entered but headcounts 0 / blank
    S4Q02_DOMAIN_2_TEXT: "Marketing digital",
    s4q02_skill_2_male: 0,
    s4q02_skill_2_female: 0,
  };

  const issuesFr = validateSectionData(entSection4, data, "fr");
  assert.ok(
    issuesFr.some((i) => i.message.includes("Les effectifs sont obligatoires pour ce domaine de compétence")),
  );

  const issuesEn = validateSectionData(entSection4, data, "en");
  assert.ok(
    issuesEn.some((i) => i.message.includes("Headcounts are required for this skill domain")),
  );
});

test("S4Q03: row 2 count entered requires training domain description (FR & EN)", () => {
  const data: FormData = {
    _scopeConfig: { training_needs: true },
    S4Q03_RESPONSE_STATUS: "REPORTED",
    s4q03_domain_1_male: 3,
    s4q03_domain_1_female: 2,
    S4Q03_DOMAIN_1_TEXT: "Leadership",
    // Row 2 count entered without text
    s4q03_domain_2_male: 1,
    s4q03_domain_2_female: 1,
    S4Q03_DOMAIN_2_TEXT: "",
  };

  const issuesFr = validateSectionData(entSection4, data, "fr");
  const issueFr = issuesFr.find((i) => i.fieldId === "S4Q03_DOMAIN_2_TEXT");
  assert.ok(issueFr, "Must flag S4Q03_DOMAIN_2_TEXT");
  assert.equal(
    issueFr?.message,
    "Le domaine de formation est obligatoire lorsqu'un effectif est saisi pour cette ligne.",
  );

  const issuesEn = validateSectionData(entSection4, data, "en");
  const issueEn = issuesEn.find((i) => i.fieldId === "S4Q03_DOMAIN_2_TEXT");
  assert.equal(
    issueEn?.message,
    "Training domain description is required when a count is entered for this row.",
  );
});

test("S4Q03: text entered requires headcounts", () => {
  const data: FormData = {
    _scopeConfig: { training_needs: true },
    S4Q03_RESPONSE_STATUS: "REPORTED",
    s4q03_domain_1_male: 3,
    s4q03_domain_1_female: 2,
    S4Q03_DOMAIN_1_TEXT: "Leadership",
    // Row 2 text entered but headcounts 0 / blank
    S4Q03_DOMAIN_2_TEXT: "Cybersécurité",
    s4q03_domain_2_male: 0,
    s4q03_domain_2_female: 0,
  };

  const issuesFr = validateSectionData(entSection4, data, "fr");
  assert.ok(
    issuesFr.some((i) => i.message.includes("Les effectifs sont obligatoires pour ce domaine de formation")),
  );

  const issuesEn = validateSectionData(entSection4, data, "en");
  assert.ok(
    issuesEn.some((i) => i.message.includes("Headcounts are required for this training domain")),
  );
});

test("CTD entity: validates S3Q02 and S4Q02 companion rows without error on absent S4Q03", () => {
  const ctd = schemaEntity("ctd");
  const ctdSection4 = ctd.sections.find((s) => s.id === "section4")!;

  const data: FormData = {
    _scopeConfig: { skills_needs: true, training_needs: false },
    S4Q02_RESPONSE_STATUS: "REPORTED",
    S4Q03_RESPONSE_STATUS: "NONE",
    s4q02_skill_1_male: 1,
    s4q02_skill_1_female: 1,
    S4Q02_DOMAIN_1_TEXT: "Comptabilité publique",
    // Row 2 count entered without text
    s4q02_skill_2_male: 2,
    s4q02_skill_2_female: 0,
    S4Q02_DOMAIN_2_TEXT: "",
  };

  const issues = validateSectionData(ctdSection4, data, "fr");
  assert.ok(issues.some((i) => i.fieldId === "S4Q02_DOMAIN_2_TEXT"));
  // S4Q03 is NONE, so it produces no issues
  assert.equal(issues.filter((i) => i.fieldId.startsWith("S4Q03")).length, 0);
});
