import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminTablePanel } from "./AdminTablePanel";

test("a background refresh announces its status and keeps the previous rows visible", () => {
  const { rerender } = renderWithProviders(
    <AdminTablePanel title="Dossiers" headingId="dossiers-heading" busy={false} busyLabel="Updating results…">
      <p>Previously loaded row</p>
    </AdminTablePanel>,
    { locale: "en" },
  );

  const panel = screen.getByRole("region", { name: "Dossiers" });
  assert.equal(panel.getAttribute("aria-busy"), null);
  assert.equal(screen.queryByRole("status"), null);
  assert.ok(screen.getByText("Previously loaded row"));

  rerender(
    <AdminTablePanel title="Dossiers" headingId="dossiers-heading" busy busyLabel="Updating results…">
      <p>Previously loaded row</p>
    </AdminTablePanel>,
  );

  assert.equal(panel.getAttribute("aria-busy"), "true");
  assert.equal(screen.getByRole("status").textContent, "Updating results…");
  assert.ok(screen.getByText("Previously loaded row"));
});
