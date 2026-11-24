import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { RegistrationsHubTabs } from "./RegistrationsHubTabs";

test("registration tabs preserve destination-relevant context without duplicating Campaign targets", () => {
  renderWithProviders(
    <RegistrationsHubTabs
      activeTab="queue"
      canReviewRegistrations
      currentQuery="vue=queue&search=atelier&type=ONG&status=PENDING_APPROVAL&assignedToMe=1&page=3&annee=2025&semestre=2&trimestre=4&context=dashboard"
    />,
    { locale: "en" },
  );

  const links = screen.getAllByRole("link");
  const organisations = links.find((link) => link.getAttribute("href")?.startsWith("/admin/inscriptions?vue=organisations"));
  const register = links.find((link) => link.getAttribute("href") === "/admin/etablissements");
  assert.ok(organisations);
  assert.ok(register);
  assert.equal(links.some((link) => link.getAttribute("href")?.startsWith("/admin/cibles")), false);
  assert.equal(organisations.getAttribute("href"), "/admin/inscriptions?vue=organisations&search=atelier&type=ONG&context=dashboard");
});
