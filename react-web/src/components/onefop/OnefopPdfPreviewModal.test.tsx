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
