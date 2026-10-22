import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FactsReview } from "./FactsReview";
import type { BeatDefinition } from "./ScopeTypes";

test("the quiz review lists each fact with structured facets and edit affordance", async () => {
  const opened: BeatDefinition[] = [];
  const { user } = renderWithProviders(
    <FactsReview
      rows={[
        {
          mainId: "applications",
          title: "Job applications",
          reponse: "Oui",
          personnels: [
            { label: "Executives", tooltip: "Executives" },
            { label: "Supervisors", tooltip: "Supervisors / Foremen" },
          ],
          ages: [{ label: "< 25 yrs", tooltip: "Under 25 (15–24 years)" }],
          cellBeats: { personnels: "application_csp", ages: "application_age" },
        },
        {
          mainId: "recruitment",
          title: "Recruitment",
          reponse: "Oui",
          typesMotifs: [{ label: "Permanent", tooltip: "Permanent" }],
          autre: [
            { label: "Persons with disabilities: Yes", beat: "recruit_disability" },
            { label: "Vulnerable people: Yes", beat: "recruit_vulnerable" },
          ],
        },
        {
          mainId: "primo_workers",
          title: "First-time entrants",
          reponse: "Non",
        },
      ]}
      onSelectBeat={(beat) => opened.push(beat)}
      hasDroppedDataWarning={false}
      onConfirmProceed={() => {}}
    />,
    { locale: "en" },
  );

  assert.equal(screen.queryByRole("table"), null);
  assert.equal(screen.queryByRole("columnheader", { name: "Fact" }), null);

  assert.equal(screen.queryByRole("status"), null);
  assert.equal(screen.queryByText(/sections enabled for data entry/), null);

  const applications = screen.getByRole("button", { name: /Job applications/ });
  assert.match(applications.textContent ?? "", /Yes/);
  assert.match(applications.textContent ?? "", /Categories:/);
  assert.match(applications.textContent ?? "", /Executives, Supervisors \/ Foremen/);
  assert.match(applications.textContent ?? "", /Age groups:/);
  assert.match(applications.textContent ?? "", /Under 25 \(15–24 years\)/);
  assert.match(applications.textContent ?? "", /Change/);
  assert.doesNotMatch(applications.textContent ?? "", /—/);

  const recruitment = screen.getByRole("button", { name: /Recruitment/ });
  assert.match(recruitment.textContent ?? "", /Contracts:/);
  assert.match(recruitment.textContent ?? "", /Permanent/);
  assert.match(recruitment.textContent ?? "", /Specific criteria:/);
  assert.match(recruitment.textContent ?? "", /Persons with disabilities: Yes · Vulnerable people: Yes/);

  const entrants = screen.getByRole("button", { name: /First-time entrants/ });
  assert.match(entrants.textContent ?? "", /No/);
  assert.doesNotMatch(entrants.textContent ?? "", /Staff|Ages|Diplomas|—/);

  await user.click(applications);
  assert.deepEqual(opened, [{ mainId: "applications" }]);
});
