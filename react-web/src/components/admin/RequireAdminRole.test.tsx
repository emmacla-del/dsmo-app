import { renderWithProviders, navigationMock, screen, waitFor } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "@/lib/auth-store";
import { RequireAdminRole } from "./RequireAdminRole";

function Harness({ path }: { path: string }) {
  navigationMock.pathname = path;
  return <RequireAdminRole><p>Contenu de la page</p></RequireAdminRole>;
}

function renderAs(role: string, path: string) {
  useAuthStore.setState({ status: "authenticated", user: { id: "user-1", role } as never });
  return renderWithProviders(<Harness path={path} />);
}

test("an auditor refused a page is sent to the audit journal", async () => {
  renderAs("AUDITOR", "/admin/dossiers");
  await waitFor(() => assert.deepEqual(navigationMock.replaced, ["/admin/journal-audit"]));
  assert.equal(screen.queryByText("Contenu de la page"), null);
});

test("an auditor on the audit journal stays there and sees the page", () => {
  renderAs("AUDITOR", "/admin/journal-audit");
  assert.ok(screen.getByText("Contenu de la page"));
  assert.deepEqual(navigationMock.replaced, []);
});

test("another role refused a page goes to its own first page", async () => {
  renderAs("CENTRAL_AGENT", "/admin/journal-audit");
  await waitFor(() => assert.deepEqual(navigationMock.replaced, ["/admin/etablissements"]));
});
