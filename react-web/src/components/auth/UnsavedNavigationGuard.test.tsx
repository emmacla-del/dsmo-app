import assert from "node:assert/strict";
import test from "node:test";
import { UnsavedNavigationGuard } from "./UnsavedNavigationGuard";
import { navigationMock, renderWithProviders, screen, userEvent } from "@/test/render";

test("unsaved navigation opens a confirmation and only follows the link on confirmation", async () => {
  renderWithProviders(
    <>
      <UnsavedNavigationGuard
        active
        title="Leave registration?"
        body="Your unsaved changes will be lost."
        cancelLabel="Stay"
        confirmLabel="Leave"
      />
      <a href="/admin/inscriptions?status=ALL">Back to the queue</a>
    </>,
  );

  await userEvent.click(screen.getByRole("link", { name: "Back to the queue" }));
  assert.equal(navigationMock.pushed.length, 0);
  assert.ok(screen.getByRole("dialog", { name: "Leave registration?" }));

  await userEvent.click(screen.getByRole("button", { name: "Stay" }));
  assert.equal(navigationMock.pushed.length, 0);
  assert.equal(screen.queryByRole("dialog"), null);

  await userEvent.click(screen.getByRole("link", { name: "Back to the queue" }));
  await userEvent.click(screen.getByRole("button", { name: "Leave" }));
  assert.deepEqual(navigationMock.pushed, ["/admin/inscriptions?status=ALL"]);
});
