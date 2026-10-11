import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModernJobsHeader } from "./ModernJobsHeader";

test("VT masthead: establishment and its number, the VT survey title, then the campaign", () => {
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
  assert.ok(screen.getByText("Recensement formation professionnelle"));
  assert.ok(screen.getByText(/4e trimestre 2026/));
  // The entity is already in VT's title, so the campaign line does not repeat it.
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

test("other surveys keep the general title and name the entity before the campaign", () => {
  renderWithProviders(<ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" />);
  assert.ok(screen.getByText("Enquête Emploi & Main-d'œuvre"));
  assert.ok(screen.getByText(/Entreprises · .*4e trimestre 2026/));
});

// ── The save status tells the truth about the account (audit R2) ─────────

function renderStatus(serverSave: Parameters<typeof ModernJobsHeader>[0]["serverSave"]) {
  return renderWithProviders(
    <ModernJobsHeader entityType="vocationalTraining" quarterCode="QUARTERLY_2026_T4_001" serverSave={serverSave} />,
  );
}

const SAVED_AT = new Date(2026, 9, 11, 14, 32);

test("answers that are only in the browser are not called saved to the account", () => {
  renderStatus({ state: "idle", savedAt: null, hasUnsavedChanges: true, onRetry: () => {} });
  assert.ok(screen.getByText("Enregistré sur cet appareil"));
  assert.equal(screen.queryByText(/votre compte/), null);
});

test("a save in flight says so, and a landed one names the time it reached the account", () => {
  const { unmount } = renderStatus({ state: "saving", savedAt: null, hasUnsavedChanges: true, onRetry: () => {} });
  assert.ok(screen.getByText("Enregistrement…"));
  unmount();

  renderStatus({ state: "saved", savedAt: SAVED_AT, hasUnsavedChanges: false, onRetry: () => {} });
  assert.ok(screen.getByText(/Enregistré sur votre compte .*14:32/));
});

test("answers typed since the last save stop the account claim", () => {
  renderStatus({ state: "saved", savedAt: SAVED_AT, hasUnsavedChanges: true, onRetry: () => {} });
  assert.ok(screen.getByText("Enregistré sur cet appareil"));
  assert.equal(screen.queryByText(/votre compte/), null);
});

test("a failed save offers the retry, and says nothing was saved", async () => {
  let retried = 0;
  const { user } = renderStatus({ state: "failed", savedAt: SAVED_AT, hasUnsavedChanges: true, onRetry: () => { retried++; } });

  assert.ok(screen.getByText(/Non enregistré/));
  await user.click(screen.getByRole("button", { name: "réessayer" }));
  assert.equal(retried, 1);
});

test("without a server state the masthead keeps reporting the local autosave", () => {
  renderWithProviders(
    <ModernJobsHeader entityType="enterprise" quarterCode="QUARTERLY_2026_T4_001" lastSavedAt={SAVED_AT} />,
  );
  assert.ok(screen.getByText(/Enregistré à .*14:32/));
});
