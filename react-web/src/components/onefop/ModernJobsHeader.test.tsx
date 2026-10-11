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
