import assert from "node:assert/strict";
import test from "node:test";
import {
  CoverageEntityTypeTable,
  CoverageTable,
  ENTITY_TYPE_HEADER_LEGEND,
  TERRITORY_HEADER_LEGEND,
} from "./CoverageTable";
import { fireEvent, loadMessages, renderWithProviders, screen } from "@/test/render";
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
  // Both grids carry Base since 2026-10-26: on the territory tab it is what
  // tells a reader whether a dash means "no company to count" or "unknown".
  assert.equal(screen.getAllByRole("columnheader", { name: "Comptes d'entreprise" }).length, 2);
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

test("every abbreviated header names itself in full on hover", () => {
  renderWithProviders(
    <>
      <CoverageTable data={coverage} expanded={new Set()} onToggle={() => {}} />
      <CoverageEntityTypeTable rows={entityTypeRows} overdueDays={coverage.overdueDays} />
    </>,
  );

  // The cells print "Terr.", "Ins.", "Inst."…: a screen reader is given the
  // full name, and `title` gives a sighted reader the same on hover. The
  // header does not stay on screen, so the help popover alone was not enough.
  const headers = [...document.querySelectorAll("thead th")];
  assert.ok(headers.length >= 18);
  for (const header of headers) {
    assert.equal(header.getAttribute("title"), header.getAttribute("aria-label"), header.textContent ?? "");
    assert.ok((header.getAttribute("title") ?? "").length > 0, header.textContent ?? "");
  }
});

test("a territory with no company account reads 0 in Base and a dash beside it", () => {
  const emptyRegion: CoverageResponse = {
    ...coverage,
    totals: { ...coverage.totals, companyCount: 0, registered: 0, registeredInYear: 0 },
    regions: [{
      ...coverage.regions[0],
      companyCount: 0,
      registered: 0,
      registeredInYear: 0,
      departments: [],
    }],
  };
  renderWithProviders(<CoverageTable data={emptyRegion} expanded={new Set()} onToggle={() => {}} />);

  const cells = [...(document.querySelector("#coverage-territory-table tbody tr.cam-target-region")?.children ?? [])];
  // Base, then the measurements over it: a measured zero would print 0, so
  // the dash says there was nothing to measure — and Base is why.
  assert.equal(cells[1].textContent, "0");
  assert.equal(cells[2].textContent, "—");
  assert.equal(cells[3].textContent, "—");
});

test("at department scope the region row states no quota and says why", () => {
  const atDepartmentScope: CoverageResponse = {
    ...coverage,
    regions: [{
      ...coverage.regions[0],
      // What `hideRegionStock` sends: the row is a heading, not a measurement.
      companyCount: null,
      registered: null,
      registeredInYear: null,
      pendingApproval: null,
      pendingReview: null,
      complementsRequested: null,
      documentsIncomplete: null,
      draft: null,
      overdue: null,
      rate: null,
      // A REGION-mode quota survives the server's own nulling, and measures
      // the whole region rather than the one department below.
      inscriptionTarget: 40,
      departments: [{
        departmentId: "mfoundi",
        name: "Mfoundi",
        ...counts,
        inscriptionTarget: 2,
        rate: 0.5,
      }],
    }],
  };
  renderWithProviders(
    <CoverageTable data={atDepartmentScope} expanded={new Set(["centre"])} onToggle={() => {}} />,
  );

  const cells = [...(document.querySelector("#coverage-territory-table tbody tr.cam-target-region")?.children ?? [])];
  assert.equal(cells[4].textContent, "—");
  assert.doesNotMatch(cells[0].textContent ?? "", /Région seule/);
  assert.match(cells[0].textContent ?? "", /Hors de votre ressort/);
  // The department's own row keeps its figures and its quota.
  const departmentCells = [...(document.querySelector("#coverage-territory-table tbody tr.cam-target-dept")?.children ?? [])];
  assert.equal(departmentCells[4].textContent, "2");
});

// The legend used to be one list naming both tabs' columns at once, so a
// reader on « Par territoire » was given Type and Part, which that tab has
// not, and Mode, which is no header at all. Each list is held against the
// abbreviations its own grid prints, in order, so a column added to one table
// without a line in its legend fails here.
function printedHeaders(tableId: string): string[] {
  return [...document.querySelectorAll(`#${tableId} thead th`)].map((header) => header.textContent ?? "");
}

function legendShorts(legend: readonly { shortLabelKey: string }[]): string[] {
  const messages = loadMessages("fr") as { adminTargets: Record<string, string> };
  return legend.map((item) => messages.adminTargets[item.shortLabelKey]);
}

test("each legend lists the abbreviations its own grid prints, in order", () => {
  renderWithProviders(
    <>
      <CoverageTable data={coverage} expanded={new Set()} onToggle={() => {}} />
      <CoverageEntityTypeTable rows={entityTypeRows} overdueDays={coverage.overdueDays} />
    </>,
  );
  // The status columns are part of both legends, so both grids are expanded.
  for (const toggle of screen.getAllByRole("button", { name: "Afficher les statuts" })) {
    fireEvent.click(toggle);
  }

  assert.deepEqual(printedHeaders("coverage-territory-table"), legendShorts(TERRITORY_HEADER_LEGEND));
  assert.deepEqual(printedHeaders("coverage-type-table"), legendShorts(ENTITY_TYPE_HEADER_LEGEND));

  // And neither legend carries the other grid's own column.
  assert.equal(legendShorts(TERRITORY_HEADER_LEGEND).includes("Part"), false);
  assert.equal(legendShorts(TERRITORY_HEADER_LEGEND).includes("Type"), false);
  assert.equal(legendShorts(ENTITY_TYPE_HEADER_LEGEND).includes("Terr."), false);
  // Mode is a sub-line under a region name, not a header of either grid.
  assert.equal(legendShorts(TERRITORY_HEADER_LEGEND).includes("Mode"), false);
});
