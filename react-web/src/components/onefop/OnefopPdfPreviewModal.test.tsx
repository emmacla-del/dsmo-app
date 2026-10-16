import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OnefopPdfPreviewModal } from "./OnefopPdfPreviewModal";

// The PDF request itself fails in tests (no network); the heading renders regardless.
test("the review window names the period, not its code", () => {
  renderWithProviders(
    <OnefopPdfPreviewModal
      isOpen
      onClose={() => {}}
      entityType="vocationalTraining"
      data={{}}
      quarterCode="QUARTERLY_2026_T4_001"
      locale="fr"
      establishmentName="Waltz"
    />,
  );
  assert.ok(screen.getByText(/Waltz • 4e trimestre 2026/));
  assert.equal(screen.queryByText(/QUARTERLY_2026_T4_001/), null);
});

// Defect 11: nothing is archived or filed until the respondent submits.
test("the review window calls itself a review copy, not the filed version", () => {
  for (const [locale, copy] of [
    ["fr", /Ceci est une copie de relecture : votre déclaration n'est transmise qu'au moment où vous la soumettez\./],
    ["en", /This is a review copy: your declaration is sent only when you submit it\./],
  ] as const) {
    const { unmount } = renderWithProviders(
      <OnefopPdfPreviewModal
        isOpen
        onClose={() => {}}
        entityType="vocationalTraining"
        data={{}}
        quarterCode="QUARTERLY_2026_T4_001"
        locale={locale}
        establishmentName="Waltz"
      />,
    );
    assert.ok(screen.getByText(copy));
    assert.equal(screen.queryByText(/archiv/i), null);
    unmount();
  }
});
