import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminFilterDisclosure } from "./AdminFilterDisclosure";

test("active filters open the disclosure, and the user can close it until active state changes", async () => {
  const result = renderWithProviders(
    <AdminFilterDisclosure label="More filters" active={false}>
      <input aria-label="Region" />
    </AdminFilterDisclosure>,
    { locale: "en" },
  );
  const details = result.container.querySelector("details");
  assert.ok(details);
  assert.equal(details.open, false);

  result.rerender(
    <AdminFilterDisclosure label="More filters" active>
      <input aria-label="Region" />
    </AdminFilterDisclosure>,
  );
  assert.equal(details.open, true);

  await result.user.click(screen.getByText("More filters"));
  assert.equal(details.open, false);

  result.rerender(
    <AdminFilterDisclosure label="More filters" active>
      <input aria-label="Region" />
      <input aria-label="Department" />
    </AdminFilterDisclosure>,
  );
  assert.equal(details.open, false, "unrelated active-filter changes must not reopen a manually closed disclosure");

  result.rerender(
    <AdminFilterDisclosure label="More filters" active={false}>
      <input aria-label="Region" />
    </AdminFilterDisclosure>,
  );
  result.rerender(
    <AdminFilterDisclosure label="More filters" active>
      <input aria-label="Region" />
    </AdminFilterDisclosure>,
  );
  assert.equal(details.open, true, "a new active-filter transition should open the disclosure");
});
