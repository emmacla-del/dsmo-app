import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { RegistrationsHubTabs } from "./RegistrationsHubTabs";

test("registration tabs preserve destination-relevant context and restart pagination", () => {
  renderWithProviders(
    <RegistrationsHubTabs
      activeTab="queue"
      canReviewRegistrations
      currentQuery="vue=queue&search=atelier&type=ONG&status=PENDING_APPROVAL&assignedToMe=1&page=3&context=dashboard"
    />,
    { locale: "en" },
  );

  const links = screen.getAllByRole("link");
  const organisations = links.find((link) => link.getAttribute("href")?.startsWith("/admin/inscriptions?vue=organisations"));
  const coverage = links.find((link) => link.getAttribute("href")?.startsWith("/admin/inscriptions?vue=coverage"));
  assert.ok(organisations);
  assert.ok(coverage);
  assert.equal(organisations.getAttribute("href"), "/admin/inscriptions?vue=organisations&search=atelier&type=ONG&context=dashboard");
  assert.equal(coverage.getAttribute("href"), "/admin/inscriptions?vue=coverage&context=dashboard");
});
