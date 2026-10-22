import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModernJobsHeader } from "./ModernJobsHeader";
import { CampaignPeriodContext } from "./CampaignPeriodContext";
import { campaignPeriodFrom } from "@/lib/campaign-period";

/** The survey sentence as read: its name is a span of its own (owner, 2026-10-22). */
function surveyLine(): string {
  const line = document.querySelector(".cam-masthead-survey");
  assert.ok(line, "no survey line");
  return line.textContent ?? "";
}

test("VT masthead: establishment and its number, then the survey and round on one line", () => {
  renderWithProviders(
    <ModernJobsHeader
      entityType="vocationalTraining"
      establishmentName="CFP Waltz"
      establishmentId="VT26000103"
      quarterCode="QUARTERLY_2026_T4_001"
      onPreviewPdf={() => {}}
    />,
  );
  assert.ok(screen.getByText("CFP Waltz"));
  assert.ok(screen.getByText(/VT26000103/));
  // The survey and the round share one line under the establishment, which
  // is the fact the respondent reads first (owner, 2026-10-12).
  assert.equal(surveyLine(), "Recensement formation professionnelle pour le 4e trimestre 2026");
  // The entity is already in VT's title, so that line does not repeat it.
  assert.equal(screen.queryByText(/Centres de formation professionnelle/), null);
  assert.ok(screen.getByRole("button", { name: /Aperçu PDF/ }));
  assert.ok(screen.getByRole("button", { name: "Mon espace" }));
});

// Owner, 2026-10-20: every ONEFOP form's masthead offers the way back to the
// respondent's workspace, by name; it runs the wizard's exit (save, then /home).
test("every form's masthead has a « Mon espace » button that runs the exit", () => {
  for (const entityType of ["vocationalTraining", "enterprise", "cooperative", "ctd", "ong", "administration", "projectProgram"]) {
    let exits = 0;
    const { unmount } = renderWithProviders(
      <ModernJobsHeader entityType={entityType} quarterCode="QUARTERLY_2026_T4_001" onExit={() => { exits += 1; }} />,
    );
    const button = screen.getByRole("button", { name: "Mon espace" });
    assert.equal(button.textContent, "Mon espace", entityType);
    button.click();
    assert.equal(exits, 1, entityType);
    unmount();
  }
});

test("the masthead carries no language switcher and no Save button", () => {
  renderWithProviders(<ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" />);
  assert.equal(screen.queryByRole("combobox"), null);
  assert.equal(screen.queryByRole("button", { name: /^(FR|EN)$/ }), null);
  assert.equal(screen.queryByRole("button", { name: /Sauvegarder/ }), null);
});

test("other surveys keep the general title and name the entity on the same line", () => {
  renderWithProviders(<ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" />);
  assert.equal(surveyLine(), "Recensement emplois modernes des Entreprises pour le 4e trimestre 2026");
  // The survey's name alone carries the brand teal.
  const name = document.querySelector(".cam-masthead-survey > span") as HTMLElement;
  assert.equal(name.textContent, "Recensement emplois modernes");
  assert.equal(name.style.color, "var(--cam-primary-dark)");
});

test("PP masthead omits the redundant entity label, keeping survey and round only", () => {
  renderWithProviders(
    <ModernJobsHeader
      entityType="projectProgram"
      establishmentName="Projet PAREC"
      establishmentId="PP26000045"
      quarterCode="QUARTERLY_2026_T4_001"
    />,
  );
  assert.ok(screen.getByText("Projet PAREC"));
  assert.ok(screen.getByText(/PP26000045/));
  assert.equal(surveyLine(), "Recensement emplois modernes pour le 4e trimestre 2026");
  assert.equal(screen.queryByText(/Projets \/ Programmes/), null);
});

// ── The bar reports only a save that did NOT land ───────────────────────
// Saving is automatic and the respondent is not told it worked (owner,
// 2026-10-11); the PDF preview shows them what the declaration holds. A
// failure still shows, with its retry: no preview can report one, and it
// is the only way back.

function renderStatus(serverSave: Parameters<typeof ModernJobsHeader>[0]["serverSave"]) {
  return renderWithProviders(
    <ModernJobsHeader entityType="vocationalTraining" quarterCode="QUARTERLY_2026_T4_001" serverSave={serverSave} />,
  );
}

const SAVED_AT = new Date(2026, 9, 11, 14, 32);

test("a save that landed is not announced", () => {
  renderStatus({ state: "saved", savedAt: SAVED_AT, hasUnsavedChanges: false, onRetry: () => {} });
  assert.equal(screen.queryByText(/Enregistré/), null);
  assert.equal(screen.queryByText(/14:32/), null);
});

test("a save in flight, and answers held only in the browser, say nothing either", () => {
  const { unmount } = renderStatus({ state: "saving", savedAt: null, hasUnsavedChanges: true, onRetry: () => {} });
  assert.equal(screen.queryByText(/Enregistrement/), null);
  unmount();

  renderStatus({ state: "idle", savedAt: null, hasUnsavedChanges: true, onRetry: () => {} });
  assert.equal(screen.queryByText(/appareil/), null);
});

test("a local autosave time is not reported either", () => {
  renderWithProviders(
    <ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" lastSavedAt={SAVED_AT} />,
  );
  assert.equal(screen.queryByText(/14:32/), null);
});

test("a failed save offers the retry, and says nothing was saved", async () => {
  let retried = 0;
  const { user } = renderStatus({ state: "failed", savedAt: SAVED_AT, hasUnsavedChanges: true, onRetry: () => { retried++; } });

  assert.ok(screen.getByText(/Non enregistré/));
  await user.click(screen.getByRole("button", { name: "réessayer" }));
  assert.equal(retried, 1);
});

// ── The round, named not dated ──────────────────────────────────────────
// The bounds repeated what the round's name already says (owner, 2026-10-22,
// revising 2026-10-18): the masthead names the round and prints no dates.
test("the masthead names the round and prints no dates", () => {
  renderWithProviders(
    <CampaignPeriodContext.Provider
      value={campaignPeriodFrom({
        code: "QUARTERLY_2026_T4_001",
        periodStart: "2026-09-30T23:00:00.000Z",
        periodEnd: "2026-12-31T22:59:59.000Z",
      })}
    >
      <ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" />
    </CampaignPeriodContext.Provider>,
  );
  assert.equal(surveyLine(), "Recensement emplois modernes des Entreprises pour le 4e trimestre 2026");
  assert.doesNotMatch(surveyLine(), /\(|\/2026|oct\./);
});

test("an unknown round code is quoted after the survey", () => {
  renderWithProviders(<ModernJobsHeader entityType="cooperative" quarterCode="X1" />);
  assert.equal(surveyLine(), "Recensement emplois modernes des Coopératives · Campagne X1");
});
