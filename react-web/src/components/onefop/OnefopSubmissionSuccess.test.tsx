import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OnefopSubmissionSuccess } from "./OnefopSubmissionSuccess";

test("the receipt names the period and the questionnaire, not their codes", () => {
  renderWithProviders(
    <OnefopSubmissionSuccess
      submissionId="03919b6d-c88c-4bad-b133-ee54b8c11dda"
      entityType="vocationalTraining"
      quarterCode="QUARTERLY_2026_T4_001"
      locale="fr"
    />,
  );
  assert.ok(screen.getByText("4e trimestre 2026"));
  assert.ok(screen.getByText("Centre de formation professionnelle"));
  assert.equal(screen.queryByText("QUARTERLY_2026_T4_001"), null);
  assert.equal(screen.queryByText(/vocationalTraining/i), null);
});

test("the receipt copy names the campaign's period instead of assuming a quarter", () => {
  renderWithProviders(
    <OnefopSubmissionSuccess entityType="vocationalTraining" quarterCode="ANNUAL_2026_AN_001" locale="fr" />,
  );
  assert.ok(screen.getByText(/Votre déclaration statistique \(Année 2026\) a été validée/));
  assert.ok(screen.getByText(/au titre de la période « Année 2026 »/));
  assert.equal(screen.queryByText(/trimestri|trimestre en cours/), null);
});

test("without a period, the copy stays general", () => {
  renderWithProviders(<OnefopSubmissionSuccess entityType="enterprise" locale="en" />);
  assert.ok(screen.getByText(/Your statistical declaration has been validated/));
  assert.ok(screen.getByText(/for the current collection period/));
});
