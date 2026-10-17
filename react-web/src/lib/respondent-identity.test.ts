import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campaignPhrase,
  declaredWorkforce,
  isTrainingCentre,
  respondentNiu,
  respondentTypeLabel,
} from "./respondent-identity";

test("respondentTypeLabel names the structure type, not the role", () => {
  assert.equal(respondentTypeLabel("VOCATIONAL_TRAINING", "fr"), "Centre de formation professionnelle");
  assert.equal(respondentTypeLabel("VOCATIONAL_TRAINING", "en"), "Vocational training centre");
  assert.equal(respondentTypeLabel("ENTREPRISE", "fr"), "Entreprise");
  assert.equal(respondentTypeLabel(null, "fr"), null);
});

test("campaignPhrase says the period in words, never the code or the all-caps title", () => {
  const quarter = {
    isOpen: true,
    code: "QUARTERLY_2026_T4_001",
    label: "COLLECTE DES DONNEES SUR LES EMPLOIS CREES PAR LE SECTEUR MODERNE DE L'ECONOMIE POUR LE QUATRIEME TRIMESTRE 2026",
  };
  assert.equal(campaignPhrase(quarter, "fr"), "Campagne du 4e trimestre 2026");
  assert.equal(campaignPhrase(quarter, "en"), "Campaign for the 4th quarter of 2026");
  assert.equal(campaignPhrase(null, "fr"), null);
});

// B6 (E2E 2026-10-17): the respondent's own header asserted two things the
// platform does not hold — a NIU for a type that never declares one, and a
// headcount nobody entered.

test("a NIU is shown only when the account declared one", () => {
  assert.equal(respondentNiu("P058812345678A"), "P058812345678A");
  assert.equal(respondentNiu("  P058812345678A  "), "P058812345678A");
  // The placeholder an administration or a project/programme carries,
  // because Company.taxNumber is NOT NULL and unique (AuthService).
  assert.equal(respondentNiu("NA-6ff0ebd0-4f9f-44c1-97be-c8caa06e6d98"), null);
  assert.equal(respondentNiu(""), null);
  assert.equal(respondentNiu(null), null);
  assert.equal(respondentNiu(undefined), null);
});

test("a workforce figure is shown only when someone entered it", () => {
  assert.equal(declaredWorkforce({ totalEmployees: 250, entityType: "ENTREPRISE" }), 250);
  // An ONEFOP account's row is created at 0 and never written again: 0 is
  // "never asked", not an answer (§9).
  assert.equal(declaredWorkforce({ totalEmployees: 0, entityType: "PROJECT_PROGRAM" }), null);
  assert.equal(declaredWorkforce({ totalEmployees: null, entityType: "ENTREPRISE" }), null);
  assert.equal(declaredWorkforce({ entityType: "ENTREPRISE" }), null);
  assert.equal(declaredWorkforce(null), null);
  assert.equal(declaredWorkforce(undefined), null);
});

test("a training centre has no employee figure at all", () => {
  assert.equal(declaredWorkforce({ totalEmployees: 40, entityType: "VOCATIONAL_TRAINING" }), null);
  assert.equal(declaredWorkforce({ totalEmployees: 40, entityType: "vocationalTraining" }), null);
  assert.equal(isTrainingCentre("VOCATIONAL_TRAINING"), true);
  assert.equal(isTrainingCentre("vocationalTraining"), true);
  assert.equal(isTrainingCentre("ENTREPRISE"), false);
  assert.equal(isTrainingCentre(null), false);
});
