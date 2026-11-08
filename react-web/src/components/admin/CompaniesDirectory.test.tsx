import { renderWithProviders, navigationMock, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { CompaniesDirectory } from "./CompaniesDirectory";

const COMPANY = { id: "c1", name: "Acme", user: null };

function Harness({ query }: { query: string }) {
  navigationMock.pathname = "/admin/annuaire";
  navigationMock.searchParams = new URLSearchParams(query);
  return <CompaniesDirectory />;
}

function renderPage(query: string, page: number, total: number) {
  return renderWithProviders(<Harness query={query} />, {
    queryData: [[["dsmo", "companies", "", page], { companies: [COMPANY], total, page, pageSize: 20 }]],
  });
}

test("the page is read from the URL and moves in the URL", async () => {
  const { user } = renderPage("tab=companies&page=2", 2, 60);
  assert.ok(screen.getByText("Page 2 sur 3"));
  await user.click(screen.getByRole("button", { name: "Suivant →" }));
  assert.deepEqual(navigationMock.replaced, ["/admin/annuaire?tab=companies&page=3"]);
});

test("the search pause does not send a reloaded page back to page 1", async () => {
  renderPage("page=2", 2, 60);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.deepEqual(navigationMock.replaced, []);
});

test("a list on one page shows no pager, and its table is a named, focusable region", () => {
  renderPage("", 1, 5);
  assert.equal(screen.queryByRole("button", { name: "Suivant →" }), null);
  assert.ok(screen.getAllByRole("region", { name: "Entités" }).some((el) => el.classList.contains("cam-table-wrapper") && el.getAttribute("tabindex") === "0"));
});
