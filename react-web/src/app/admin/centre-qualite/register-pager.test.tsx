import { renderWithProviders, navigationMock, screen, waitFor } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "@/lib/auth-store";
import CentreQualitePage from "./page";

function Harness({ query }: { query: string }) {
  navigationMock.pathname = "/admin/centre-qualite";
  navigationMock.searchParams = new URLSearchParams(query);
  return <CentreQualitePage />;
}

function renderRegister(query: string, page: number, total: number) {
  useAuthStore.setState({ status: "authenticated", user: { id: "user-1", role: "ADMIN_ONEFOP" } as never });
  return renderWithProviders(<Harness query={query} />, {
    queryData: [[["admin", "anomalies", "registry", "ALL", "ALL", "ALL", page], { items: [], total }]],
  });
}

test("a register longer than one page offers the pager and moves in the URL", async () => {
  const { user } = renderRegister("vue=registre&page=2", 2, 120);
  assert.ok(screen.getByText("Page 2 / 3"));
  await user.click(screen.getByRole("button", { name: "Suivant" }));
  assert.deepEqual(navigationMock.replaced, ["/admin/centre-qualite?vue=registre&page=3"]);
});

test("going back to the first page drops the page from the URL", async () => {
  const { user } = renderRegister("vue=registre&page=2", 2, 120);
  await user.click(screen.getByRole("button", { name: "Précédent" }));
  assert.deepEqual(navigationMock.replaced, ["/admin/centre-qualite?vue=registre"]);
});

test("a register that fits on one page shows no pager", () => {
  renderRegister("vue=registre", 1, 50);
  assert.equal(screen.queryByRole("button", { name: "Suivant" }), null);
});

test("the register's table is a named, focusable region, and the header claims no campaign", () => {
  const { container } = renderRegister("vue=registre", 1, 50);
  assert.ok(screen.getAllByRole("region", { name: /Registre/ }).some((el) => el.classList.contains("cam-table-wrapper") && el.getAttribute("tabindex") === "0"));
  assert.equal(container.querySelector(".cam-admin-campaign-pill"), null);
});

test("a page past the end falls back to the last page", async () => {
  renderRegister("vue=registre&page=4", 4, 120);
  await waitFor(() => assert.deepEqual(navigationMock.replaced, ["/admin/centre-qualite?vue=registre&page=3"]));
});
