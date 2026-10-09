import { test } from "node:test";
import assert from "node:assert/strict";
import { entityTypeDisplayName, referencePeriodLabel, referencePeriodPhrases } from "./onefop-period-label";

test("campaign and fallback period codes read as a period, in both languages", () => {
  assert.equal(referencePeriodLabel("QUARTERLY_2026_T4_001", "fr"), "4e trimestre 2026");
  assert.equal(referencePeriodLabel("QUARTERLY_2026_T1_002", "fr"), "1er trimestre 2026");
  assert.equal(referencePeriodLabel("2026-T4", "fr"), "4e trimestre 2026");
  assert.equal(referencePeriodLabel("QUARTERLY_2026_T4_001", "en"), "Q4 2026");
  assert.equal(referencePeriodLabel("SEMESTER_2026_S2_003", "fr"), "2e semestre 2026");
  assert.equal(referencePeriodLabel("SEMESTER_2026_S1_001", "en"), "H1 2026");
  assert.equal(referencePeriodLabel("ANNUAL_2026_AN_007", "fr"), "Année 2026");
});

test("an unrecognised or missing period code is not guessed at", () => {
  assert.equal(referencePeriodLabel("CUSTOM-RUN", "fr"), "CUSTOM-RUN");
  assert.equal(referencePeriodLabel(undefined, "fr"), "");
});

test("entity types read as the registration form names them", () => {
  assert.equal(entityTypeDisplayName("vocationalTraining", "fr"), "Centre de formation professionnelle");
  assert.equal(entityTypeDisplayName("enterprise", "en"), "Enterprise");
  assert.equal(entityTypeDisplayName("unknownType", "fr"), "unknownType");
});

test("in-sentence phrases carry the right article for each kind of period", () => {
  assert.deepEqual(referencePeriodPhrases("QUARTERLY_2026_T3_001", "fr"), { forPeriod: "pour le 3e trimestre 2026", inRespectOf: "au titre du 3e trimestre 2026", campaign: "Campagne du 3e trimestre 2026" });
  assert.deepEqual(referencePeriodPhrases("SEMESTER_2026_S1_001", "fr"), { forPeriod: "pour le 1er semestre 2026", inRespectOf: "au titre du 1er semestre 2026", campaign: "Campagne du 1er semestre 2026" });
  assert.deepEqual(referencePeriodPhrases("ANNUAL_2026_AN_001", "fr"), { forPeriod: "pour l'année 2026", inRespectOf: "au titre de l'année 2026", campaign: "Campagne de l'année 2026" });
  assert.equal(referencePeriodPhrases("2026-T4", "en")?.inRespectOf, "for the 4th quarter of 2026");
  assert.equal(referencePeriodPhrases("SEMESTER_2026_S2_003", "en")?.forPeriod, "for the 2nd half of 2026");
  assert.equal(referencePeriodPhrases("2026-T4", "en")?.campaign, "Campaign for the 4th quarter of 2026");
  assert.equal(referencePeriodPhrases("CUSTOM-RUN", "fr"), null);
});
