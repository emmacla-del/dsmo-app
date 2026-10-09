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

test("the receipt copy names the quarter in full, with its article", () => {
  renderWithProviders(
    <OnefopSubmissionSuccess entityType="vocationalTraining" quarterCode="QUARTERLY_2026_T3_001" locale="fr" />,
  );
  assert.ok(screen.getByText(/Votre déclaration statistique pour le 3e trimestre 2026 a été validée/));
  assert.ok(screen.getByText(/de déclaration statistique au titre du 3e trimestre 2026, conformément/));
  assert.equal(screen.queryByText(/trimestrielle|trimestre en cours|période «/), null);
});

test("an annual campaign reads 'de l'année', and English names the quarter in words", () => {
  renderWithProviders(<OnefopSubmissionSuccess entityType="vocationalTraining" quarterCode="ANNUAL_2026_AN_001" locale="fr" />);
  assert.ok(screen.getByText(/au titre de l'année 2026, conformément/));
  renderWithProviders(<OnefopSubmissionSuccess entityType="enterprise" quarterCode="2026-T4" locale="en" />);
  assert.ok(screen.getByText(/Your statistical declaration for the 4th quarter of 2026 has been validated/));
});

test("without a period, the copy stays general", () => {
  renderWithProviders(<OnefopSubmissionSuccess entityType="enterprise" locale="en" />);
  assert.ok(screen.getByText(/Your statistical declaration has been validated/));
  assert.ok(screen.getByText(/for the current collection period/));
});
