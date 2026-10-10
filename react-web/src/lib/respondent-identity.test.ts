import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignPhrase, respondentTypeLabel } from "./respondent-identity";

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
