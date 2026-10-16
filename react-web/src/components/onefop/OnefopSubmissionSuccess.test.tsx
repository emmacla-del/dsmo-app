import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OnefopSubmissionSuccess } from "./OnefopSubmissionSuccess";

const REF = "03919b6d-c88c-4bad-b133-ee54b8c11dda";

test("the receipt names the period and the questionnaire, not their codes", () => {
  renderWithProviders(
    <OnefopSubmissionSuccess submissionId={REF} entityType="vocationalTraining" quarterCode="QUARTERLY_2026_T4_001" locale="fr" />,
  );
  assert.ok(screen.getByText("4e trimestre 2026"));
  assert.ok(screen.getByText("Centre de formation professionnelle"));
  assert.ok(screen.getByText(REF));
  assert.equal(screen.queryByText("QUARTERLY_2026_T4_001"), null);
  assert.equal(screen.queryByText(/vocationalTraining/i), null);
});

test("it says the declaration is received and awaiting review, nothing more", () => {
  const { container } = renderWithProviders(
    <OnefopSubmissionSuccess submissionId={REF} entityType="vocationalTraining" quarterCode="QUARTERLY_2026_T3_001" locale="en" />,
    { locale: "en" },
  );
  const text = container.textContent ?? "";
  assert.match(text, /ONEFOP has received your statistical declaration for the 3rd quarter of 2026/);
  assert.match(text, /Awaiting review by ONEFOP/);
  assert.match(text, /If ONEFOP asks for a correction/);
  // Removed until MINEFOP signs off a wording (defect 2).
  assert.doesNotMatch(text, /validated|valid receipt|proof for inspection|CNPS|Labou?r Inspect|Directorate/i);
});

test("French says the same, and an annual campaign reads 'pour l'année'", () => {
  const { container } = renderWithProviders(
    <OnefopSubmissionSuccess entityType="vocationalTraining" quarterCode="ANNUAL_2026_AN_001" locale="fr" />,
  );
  const text = container.textContent ?? "";
  assert.match(text, /L'ONEFOP a bien reçu votre déclaration statistique pour l'année 2026/);
  assert.match(text, /En attente d'examen par l'ONEFOP/);
  assert.doesNotMatch(text, /validée|récépissé valide|fait foi|CNPS|Inspection du Travail/i);
});

test("without a period or a reference, the copy stays general and nothing is invented", () => {
  const { container } = renderWithProviders(<OnefopSubmissionSuccess entityType="enterprise" locale="en" />, { locale: "en" });
  const text = container.textContent ?? "";
  assert.match(text, /ONEFOP has received your statistical declaration\. Thank you\./);
  assert.doesNotMatch(text, /ONEFOP-REF|ONEFOP-SUB/);
});

test("one primary action; download and print are secondary", async () => {
  let home = 0;
  let downloads = 0;
  const { container, user } = renderWithProviders(
    <OnefopSubmissionSuccess
      submissionId={REF}
      locale="en"
      onReturnToDashboard={() => { home++; }}
      onDownloadPdf={() => { downloads++; }}
      onPrint={() => {}}
    />,
    { locale: "en" },
  );
  assert.equal(container.querySelectorAll(".cam-button-primary").length, 1);
  await user.click(screen.getByRole("button", { name: "Back to home" }));
  await user.click(screen.getByRole("button", { name: "Download a copy (PDF)" }));
  assert.equal(home, 1);
  assert.equal(downloads, 1);
});
