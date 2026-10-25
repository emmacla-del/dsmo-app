import assert from "node:assert/strict";
import test from "node:test";
import { CoverageEntityTypeTable, CoverageTable } from "./CoverageTable";
import { fireEvent, renderWithProviders, screen } from "@/test/render";
import type { CoverageEntityTypeRow, CoverageResponse } from "@/lib/pilotage-targets";
import { coverageGrade } from "@/lib/coverage-grade";

const counts = {
  companyCount: 1,
  registered: 1,
  registeredInYear: 1,
  pendingApproval: 0,
  pendingReview: 0,
  complementsRequested: 0,
  documentsIncomplete: 0,
  draft: 0,
  overdue: 0,
};

const coverage: CoverageResponse = {
  year: 2026,
  overdueDays: 7,
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
      <CoverageEntityTypeTable rows={entityTypeRows} overdueDays={coverage.overdueDays} />
    </>,
  );

  const headers = [...document.querySelectorAll("th[id$='registered-period']")];
  assert.deepEqual(headers.map((header) => header.id), [
    "coverage-territory-registered-period",
    "coverage-type-registered-period",
  ]);
  assert.equal(document.getElementById("coverage-territory-table")?.classList.contains("cam-dash-table"), true);
  assert.equal(document.getElementById("coverage-type-table")?.classList.contains("cam-dash-table"), true);
  assert.ok(document.querySelector("#coverage-territory-table thead .coverage-sticky-column"));
  assert.ok(document.querySelector("#coverage-type-table thead .coverage-sticky-column"));
  assert.equal(new Set(headers.map((header) => header.id)).size, headers.length);
  assert.equal(screen.getAllByRole("columnheader", { name: "Comptes actifs inscrits pendant la période sélectionnée" }).length, 2);
  assert.equal(screen.getAllByRole("columnheader", { name: "Comptes actifs inscrits pendant la période sélectionnée" })[0].textContent, "Inscrits/période");
  assert.equal(screen.getAllByRole("columnheader", { name: "Comptes d'entreprise" }).length, 1);
  assert.equal(screen.getAllByRole("columnheader", { name: "Inscriptions en attente actuellement depuis plus de 7 jours" }).length, 2);
  assert.equal(screen.getAllByRole("columnheader", { name: "Niveau de couverture" }).length, 2);
  assert.equal(screen.getAllByText("Excellent · 100 %").length, 3);
  assert.equal(document.querySelectorAll(".coverage-grade-badge.cam-badge-success").length, 3);
  assert.equal(document.querySelectorAll(".coverage-period-cell").length, 3);
  assert.equal(screen.queryByRole("columnheader", { name: "Année" }), null);
  assert.equal(screen.queryByRole("columnheader", { name: "Semestre" }), null);
  assert.equal(screen.queryByRole("columnheader", { name: "Trimestre" }), null);
  assert.equal(document.querySelectorAll('td[headers="coverage-territory-registered-period"]').length, 2);
  assert.equal(document.querySelectorAll('td[headers="coverage-type-registered-period"]').length, 1);
  assert.equal(screen.queryByRole("columnheader", { name: "En attente d’approbation" }), null);
});

test("the total-scope explanation is not repeated beneath the table", () => {
  const { container } = renderWithProviders(
    <CoverageTable data={coverage} expanded={new Set()} onToggle={() => {}} />,
  );

  assert.doesNotMatch(container.textContent ?? "", /Le total compte chaque entreprise une seule fois/);
});

test("workflow status columns are collapsed until explicitly requested", () => {
  renderWithProviders(
    <>
      <CoverageTable data={coverage} expanded={new Set()} onToggle={() => {}} />
      <CoverageEntityTypeTable rows={entityTypeRows} overdueDays={coverage.overdueDays} />
    </>,
  );

  const toggles = screen.getAllByRole("button", { name: "Afficher les statuts" });
  assert.equal(toggles.length, 2);
  assert.equal(screen.queryByRole("columnheader", { name: "En attente d’approbation" }), null);

  fireEvent.click(toggles[0]);
  assert.equal(screen.getAllByRole("columnheader", { name: "En attente d’approbation" }).length, 1);
  assert.equal(screen.getAllByRole("columnheader", { name: "Statut d’inscription" }).length, 1);
  assert.equal(screen.getAllByRole("button", { name: "Afficher les statuts" }).length, 1);
  assert.equal(screen.getAllByRole("button", { name: "Masquer les statuts" }).length, 1);
});

test("coverage grades use the dashboard's attainment thresholds", () => {
  assert.equal(coverageGrade(0.2999)?.key, "critical");
  assert.equal(coverageGrade(0.3)?.key, "veryPoor");
  assert.equal(coverageGrade(0.5)?.key, "poor");
  assert.equal(coverageGrade(0.75)?.key, "average");
  assert.equal(coverageGrade(0.9)?.key, "good");
  assert.equal(coverageGrade(1)?.key, "excellent");
  assert.equal(coverageGrade(null), null);
});

test("non-zero overdue counts link to the matching territorial and entity-type queues", () => {
  const region = coverage.regions[0];
  const areaCoverage: CoverageResponse = {
    ...coverage,
    regions: [
      {
        ...region,
        overdue: 2,
        departments: [
          {
            departmentId: "mfoundi",
            name: "Mfoundi",
            ...counts,
            overdue: 1,
            inscriptionTarget: null,
            rate: null,
          },
        ],
      },
    ],
  };
  const typeRows = [{ ...entityTypeRows[0], overdue: 1 }];

  renderWithProviders(
    <>
      <CoverageTable
        data={areaCoverage}
        expanded={new Set(["centre"])}
        onToggle={() => {}}
        overdueHref={(regionName, departmentName) => {
          const params = new URLSearchParams({ status: "OVERDUE", region: regionName });
          if (departmentName) params.set("department", departmentName);
          return `/admin/inscriptions?${params.toString()}`;
        }}
      />
      <CoverageEntityTypeTable
        rows={typeRows}
        overdueDays={coverage.overdueDays}
        overdueHref={(entityType) => `/admin/inscriptions?status=OVERDUE&type=${entityType}`}
      />
    </>,
  );

  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="status=OVERDUE"]')];
  assert.ok(links.every((link) => link.classList.contains("cam-badge-warning")));
  assert.deepEqual(links.map((link) => link.getAttribute("href")), [
    "/admin/inscriptions?status=OVERDUE&region=Centre",
    "/admin/inscriptions?status=OVERDUE&region=Centre&department=Mfoundi",
    "/admin/inscriptions?status=OVERDUE&type=ENTREPRISE",
  ]);
});
