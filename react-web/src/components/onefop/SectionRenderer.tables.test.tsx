import { renderWithProviders, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import { SectionRenderer } from "./SectionRenderer";
import { PP_SECTION4_TABLES } from "@/lib/pp-section4-tables";

// A section with several tables and no subsections of its own used to put
// every one of them on a single screen: Project/Programme Section 4 stacked
// six CSP x sex x age grids with no table list, no table-by-table
// Previous/Next and no "table n of m". It is cut at each table now, the
// reading the subsectioned sections and the training-centre wizard give.

function renderSection(entityName: string, sectionId: string, data: Record<string, unknown> = {}) {
  const entity = schemaEntity(entityName);
  const section = entity.sections.find((s) => s.id === sectionId)!;
  const result = renderWithProviders(
    <SectionRenderer section={section} data={data} onChange={() => {}} entityType={entity.entityType} />,
  );
  const q = within(result.container);
  const pills = q
    .queryAllByRole("button")
    .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((label) => label && label !== "Tableau" && label !== "Guidé");
  return { ...result, pills, tableCount: result.container.querySelectorAll("table").length };
}

const reported = (codes: string[]) => Object.fromEntries(codes.map((c) => [`${c}_RESPONSE_STATUS`, "REPORTED"]));

const ALL_PP_S4 = ["S4Q01", "S4Q02", "S4Q03", "S4Q04", "S4Q05", "S4Q06"];

test("project Section 4 shows one table at a time, listed by name", () => {
  const { pills, tableCount, unmount } = renderSection(
    "projectProgram",
    "section4_projectProgram",
    reported(ALL_PP_S4),
  );
  assert.equal(tableCount, 1, "more than one table is on screen");
  assert.deepEqual(
    pills.map((p) => p.replace(/^✓\s*/, "")),
    PP_SECTION4_TABLES.map((t) => `${t.number} ${t.name.fr}`),
  );
  unmount();
});

test("project Section 4 counts its tables in the section summary", () => {
  const { container, unmount } = renderSection("projectProgram", "section4_projectProgram", reported(ALL_PP_S4));
  assert.match(container.textContent ?? "", /6 tableaux statistiques/);
  unmount();
});

test("a table the quiz closed is not one of the screens", () => {
  const data = { ...reported(["S4Q01", "S4Q03"]), S4Q02_RESPONSE_STATUS: "NONE", S4Q04_RESPONSE_STATUS: "NONE", S4Q05_RESPONSE_STATUS: "NONE", S4Q06_RESPONSE_STATUS: "NONE" };
  const { pills, unmount } = renderSection("projectProgram", "section4_projectProgram", data);
  assert.deepEqual(
    pills.map((p) => p.replace(/^✓\s*/, "")),
    ["4.1 Permanents recensés", "4.3 Permanents recrutés"],
  );
  unmount();
});

// §8: a paper code is internal and never reaches a respondent's screen, so a
// table with no name of its own is listed by its own question instead.
test("the table list never shows a paper code", () => {
  for (const [entity, section, codes] of [
    ["projectProgram", "section4_projectProgram", ALL_PP_S4],
    ["enterprise", "section3", ["S3Q01", "S3Q02", "S3Q03"]],
    ["enterprise", "section4", ["S4Q01", "S4Q02", "S4Q03"]],
    ["administration", "section2", ["S21Q01", "S21Q02", "S21Q03", "S21Q04"]],
  ] as const) {
    const { pills, tableCount, unmount } = renderSection(entity, section, reported([...codes]));
    assert.equal(tableCount, 1, `${entity}/${section} shows ${tableCount} tables at once`);
    assert.equal(pills.length, codes.length, `${entity}/${section} lists ${pills.length} tables`);
    for (const pill of pills) {
      assert.ok(!/S[0-9]+Q[0-9]+/.test(pill), `${entity}/${section}: "${pill}" is a paper code`);
      assert.ok(pill.replace(/^✓\s*/, "").length > 3, `${entity}/${section}: "${pill}" says nothing`);
    }
    unmount();
  }
});

// The sections the paper form does divide are still cut along its own
// divisions, with the list's running number in front of each.
test("enterprise Section 2 keeps the paper form's own three parts", () => {
  const { pills, unmount } = renderSection(
    "enterprise",
    "section2",
    reported(["S21Q01", "S22Q01", "S22Q02", "S22Q03", "S22Q04", "S22Q05", "S23Q01", "S23Q02"]),
  );
  assert.deepEqual(pills.map((p) => p.replace(/^✓\s*/, "").slice(0, 2)), ["1.", "2.", "3."]);
  unmount();
});

// A section with a single table has nothing to navigate between.
test("a one-table section has no table list", () => {
  const { pills, unmount } = renderSection("projectProgram", "section3_projectProgram");
  assert.deepEqual(pills, []);
  unmount();
});
