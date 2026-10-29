import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DossierResponseRateKpi } from "./DossierResponseRateKpi";

test("the response-rate KPI is hidden for All campaigns", () => {
  renderWithProviders(<DossierResponseRateKpi campaignId="" value="42%" />, { locale: "en" });
  assert.equal(screen.queryByText("Response rate"), null);
  assert.equal(screen.queryByText("42%"), null);
});

test("a campaign-scoped response rate identifies its campaign", () => {
  renderWithProviders(
    <DossierResponseRateKpi campaignId="campaign-1" campaignLabel="2026 T4 - October round" value="42%" />,
    { locale: "en" },
  );
  assert.ok(screen.getByText("Response rate"));
  assert.ok(screen.getByText("Campaign: 2026 T4 - October round"));
  assert.ok(screen.getByText("42%"));
});
