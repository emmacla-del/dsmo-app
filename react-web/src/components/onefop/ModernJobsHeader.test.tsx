import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModernJobsHeader } from "./ModernJobsHeader";
import { CampaignPeriodContext } from "./CampaignPeriodContext";
import { campaignPeriodFrom } from "@/lib/campaign-period";

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
  assert.ok(screen.getByText(/^Recensement formation professionnelle · .*4e trimestre 2026$/));
  // The entity is already in VT's title, so that line does not repeat it.
  assert.equal(screen.queryByText(/Centres de formation professionnelle/), null);
  assert.ok(screen.getByRole("button", { name: /Aperçu PDF/ }));
  assert.ok(screen.getByRole("button", { name: /Quitter/ }));
});

test("the masthead carries no language switcher and no Save button", () => {
  renderWithProviders(<ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" />);
  assert.equal(screen.queryByRole("combobox"), null);
  assert.equal(screen.queryByRole("button", { name: /^(FR|EN)$/ }), null);
  assert.equal(screen.queryByRole("button", { name: /Sauvegarder/ }), null);
});

test("other surveys keep the general title and name the entity on the same line", () => {
  renderWithProviders(<ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" />);
  assert.ok(screen.getByText(/^Enquête Emploi & Main-d'œuvre · Entreprises · .*4e trimestre 2026$/));
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

// ── The round's exact bounds ────────────────────────────────────────────
// The questions name the round (« au cours du trimestre ») instead of
// printing its dates (lib/campaign-period.ts, owner 2026-10-18), so the
// masthead is where the respondent reads the bounds.
test("the masthead states the round's dates once, and nothing when there is no period", () => {
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
  assert.ok(screen.getByText(/4e trimestre 2026 \(01\/10\/2026 – 31\/12\/2026\)$/));
});

test("with no period the campaign line carries no parenthesis", () => {
  renderWithProviders(<ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" />);
  assert.ok(screen.getByText(/4e trimestre 2026$/));
});
