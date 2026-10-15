import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadOnefopSchema } from "@/test/schema";
import { DossierVtSections } from "./DossierVtSections";

const DATA = {
  VT1_2: "CFP Test E2E Douala",
  VT2_1: "Oui/ Yes",
  s4q1_licence_male: "3",
  s4q1_licence_female: "2",
  s8q8_row1_lastName: "Ngono",
  s8q8_row1_firstName: "Paul",
};

test("renders the nine VT sections with answers and tables, Section 1 open", () => {
  const { container } = renderWithProviders(
    <DossierVtSections schema={loadOnefopSchema()} data={DATA} canSeeStaffNames />,
    { locale: "en" },
  );
  const sections = container.querySelectorAll("details.cam-dossier-section");
  assert.equal(sections.length, 9);
  assert.equal((sections[0] as HTMLDetailsElement).open, true);
  assert.equal((sections[1] as HTMLDetailsElement).open, false);
  assert.ok(screen.getByText("CFP Test E2E Douala"));
  // 2.1.1 answered Yes; an unanswered question says so.
  assert.ok(screen.getAllByText("Yes").length >= 1);
  assert.ok(screen.getAllByText("Not answered").length > 0);
  // Section 4 table 4.1, read-only, total derived.
  const tables = sections[3].querySelectorAll("table.cam-table");
  assert.ok(tables.length >= 1);
  assert.equal(sections[3].querySelectorAll("input").length, 0);
  assert.ok(screen.getByText("Ngono Paul"));
});

test("withholds the 8.8 names from a non-central reviewer", () => {
  renderWithProviders(<DossierVtSections schema={loadOnefopSchema()} data={DATA} canSeeStaffNames={false} />, {
    locale: "en",
  });
  assert.equal(screen.queryByText("Ngono Paul"), null);
  assert.ok(screen.getByText("The named staff list is shown to central ONEFOP administrators only."));
});

test("a closed centre's sections 2-9 say they were not asked", () => {
  renderWithProviders(
    <DossierVtSections schema={loadOnefopSchema()} data={{ VT1_12: "Fermée/ Closed" }} canSeeStaffNames />,
    { locale: "fr" },
  );
  assert.equal(screen.getAllByText("Non posée : le centre s'est déclaré fermé ou non fonctionnel en 1.12.").length, 8);
});
