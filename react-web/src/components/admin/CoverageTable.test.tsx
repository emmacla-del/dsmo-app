import assert from "node:assert/strict";
import test from "node:test";
import { CoverageEntityTypeTable, CoverageTable } from "./CoverageTable";
import { renderWithProviders, screen } from "@/test/render";
import type { CoverageEntityTypeRow, CoverageResponse } from "@/lib/pilotage-targets";

const counts = {
  companyCount: 1,
  registered: 1,
  registeredInYear: 1,
  pendingApproval: 0,
  pendingReview: 0,
  complementsRequested: 0,
  documentsIncomplete: 0,
  draft: 0,
};

const coverage: CoverageResponse = {
  year: 2026,
  period: { year: 2026, quarter: 1, semester: 1, campaignIds: [] },
  totals: { ...counts, inscriptionTarget: 1, rate: 1 },
  central: null,
  unassigned: null,
  nullEntityType: null,
  regions: [
    {
      regionId: "centre",
      name: "Centre",
      mode: "REGION",
      ...counts,
      inscriptionTarget: 1,
      rate: 1,
      departments: [],
    },
  ],
};

const entityTypeRows: CoverageEntityTypeRow[] = [
  { ...counts, entityType: "ENTREPRISE", inscriptionTarget: 1, rate: 1 },
];

test("coverage tables show the selected period once and use unique period-header IDs", () => {
  renderWithProviders(
    <>
      <CoverageTable data={coverage} expanded={new Set()} onToggle={() => {}} />
      <CoverageEntityTypeTable rows={entityTypeRows} />
    </>,
  );

  const headers = [...document.querySelectorAll("th[id$='approved-period']")];
  assert.deepEqual(headers.map((header) => header.id), [
    "coverage-territory-approved-period",
    "coverage-type-approved-period",
  ]);
  assert.equal(new Set(headers.map((header) => header.id)).size, headers.length);
  assert.equal(screen.getAllByRole("columnheader", { name: "Comptes actifs avec identifiants approuvés" }).length, 2);
  assert.equal(screen.queryByRole("columnheader", { name: "Année" }), null);
  assert.equal(screen.queryByRole("columnheader", { name: "Semestre" }), null);
  assert.equal(screen.queryByRole("columnheader", { name: "Trimestre" }), null);
  assert.equal(document.querySelectorAll('td[headers="coverage-territory-approved-period"]').length, 2);
  assert.equal(document.querySelectorAll('td[headers="coverage-type-approved-period"]').length, 1);
});
