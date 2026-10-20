import { renderWithProviders, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaEntity } from "@/test/schema";
import { SectionRenderer } from "./SectionRenderer";
import { PP_SECTION4_TABLES } from "@/lib/pp-section4-tables";

// Tableau shows a whole section at once: every table the preliminary
// questionnaire kept stands in one continuous column, which the respondent
// fills by scrolling. The section is still cut at each table (or at the
// paper form's own subsections) so the pinned list can name them and jump
// to one; Guidé still shows one table at a time, since asking one question
// per screen is what it is for.

function renderSection(
  entityName: string,
  sectionId: string,
  data: Record<string, unknown> = {},
  entryMode: "grid" | "guided" = "grid",
) {
  const entity = schemaEntity(entityName);
  const section = entity.sections.find((s) => s.id === sectionId)!;
  const result = renderWithProviders(
    <SectionRenderer
      section={section}
      data={data}
      onChange={() => {}}
      entityType={entity.entityType}
      entryMode={entryMode}
    />,
  );
  const q = within(result.container);
  // What heads each table in the column: the official form's numbered name
  // where there is one, the paper form's own subsection heading where the
  // section has those, and otherwise the table's own question.
  const chunkTitles = [...result.container.querySelectorAll('[id^="subsection-"]')].map((el) =>
    (el.querySelector("h2")?.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
  // The pinned table list is gone (owner, 2026-10-20): nothing may offer the
  // headings again as a clickable index.
  const listButtons = q
    .queryAllByRole("button")
    .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").replace(/^✓\s*/, "").trim())
    .filter((label) => chunkTitles.includes(label));
  return {
    ...result,
    chunkTitles,
    listButtons,
    tableCount: result.container.querySelectorAll("table").length,
    // Guidé draws a table as a question-by-question flow, with no <table>
    // element of its own, so counting the mounted tables is what tells the
    // continuous column and the one-at-a-time flow apart.
    mountedTables: result.container.querySelectorAll('[data-testid^="adaptive-table-"]').length,
  };
}

const reported = (codes: string[]) => Object.fromEntries(codes.map((c) => [`${c}_RESPONSE_STATUS`, "REPORTED"]));

const ALL_PP_S4 = ["S4Q01", "S4Q02", "S4Q03", "S4Q04", "S4Q05", "S4Q06"];

test("project Section 4 shows its six tables in one column, each headed by name", () => {
  const { chunkTitles, listButtons, tableCount, unmount } = renderSection(
    "projectProgram",
    "section4_projectProgram",
    reported(ALL_PP_S4),
  );
  assert.equal(tableCount, 6, "the section's tables are not all on screen");
  assert.deepEqual(chunkTitles, PP_SECTION4_TABLES.map((t) => `${t.number} ${t.name.fr}`));
  assert.deepEqual(listButtons, [], "the table list is back, saying the headings a second time");
  unmount();
});

test("project Section 4 counts its tables in the section summary", () => {
  const { container, unmount } = renderSection("projectProgram", "section4_projectProgram", reported(ALL_PP_S4));
  assert.match(container.textContent ?? "", /6 tableaux statistiques/);
  unmount();
});

test("a table the quiz closed is not one of the screens", () => {
  const data = { ...reported(["S4Q01", "S4Q03"]), S4Q02_RESPONSE_STATUS: "NONE", S4Q04_RESPONSE_STATUS: "NONE", S4Q05_RESPONSE_STATUS: "NONE", S4Q06_RESPONSE_STATUS: "NONE" };
  const { chunkTitles, unmount } = renderSection("projectProgram", "section4_projectProgram", data);
  assert.deepEqual(chunkTitles, ["4.1 Permanents recensés", "4.3 Permanents recrutés"]);
  unmount();
});

// §8: a paper code is internal and never reaches a respondent's screen, so a
// table with no name of its own is headed by its own question instead.
test("no table is headed by a paper code", () => {
  for (const [entity, section, codes] of [
    ["projectProgram", "section4_projectProgram", ALL_PP_S4],
    ["enterprise", "section3", ["S3Q01", "S3Q02", "S3Q03"]],
    ["enterprise", "section4", ["S4Q01", "S4Q02", "S4Q03"]],
    ["administration", "section2", ["S21Q01", "S21Q02", "S21Q03", "S21Q04"]],
  ] as const) {
    const { chunkTitles, tableCount, unmount } = renderSection(entity, section, reported([...codes]));
    assert.equal(tableCount, codes.length, `${entity}/${section} shows ${tableCount} of ${codes.length} tables`);
    assert.equal(chunkTitles.length, codes.length, `${entity}/${section} has ${chunkTitles.length} tables`);
    for (const title of chunkTitles) {
      assert.ok(!/S[0-9]+Q[0-9]+/.test(title), `${entity}/${section}: "${title}" is a paper code`);
      assert.ok(title.length > 3, `${entity}/${section}: "${title}" says nothing`);
    }
    unmount();
  }
});

// The sections the paper form does divide are still cut along its own
// divisions, and each part is headed by the name the form gives it.
test("enterprise Section 2 keeps the paper form's own three parts", () => {
  const { chunkTitles, unmount } = renderSection(
    "enterprise",
    "section2",
    reported(["S21Q01", "S22Q01", "S22Q02", "S22Q03", "S22Q04", "S22Q05", "S23Q01", "S23Q02"]),
  );
  assert.equal(chunkTitles.length, 3, `the three parts are ${JSON.stringify(chunkTitles)}`);
  for (const title of chunkTitles) {
    assert.ok(title.length > 3, `a part has no heading: ${JSON.stringify(chunkTitles)}`);
  }
  unmount();
});

// The summary counts the tables themselves, not the parts the list is cut
// into: one part of enterprise Section 2 (« Recrutements ») holds five of
// them, and the whole column is on screen to be counted.
test("the section summary counts the tables, not the parts of the column", () => {
  const { container, chunkTitles, unmount } = renderSection(
    "enterprise",
    "section2",
    reported(["S21Q01", "S22Q01", "S22Q02", "S22Q03", "S22Q04", "S22Q05", "S23Q01", "S23Q02"]),
  );
  assert.equal(chunkTitles.length, 3, "the paper form's own three parts are not the column's parts");
  assert.match(container.textContent ?? "", /8 tableaux statistiques/);
  unmount();
});

// Every table is headed where it stands, so a pinned index of the same names
// said them twice and cost 50px at the top of every section.
test("no section offers its headings again as a table list", () => {
  for (const [entity, section, codes] of [
    ["projectProgram", "section4_projectProgram", ALL_PP_S4],
    ["enterprise", "section2", ["S21Q01", "S22Q01", "S22Q02", "S22Q03", "S22Q04", "S22Q05", "S23Q01", "S23Q02"]],
    ["projectProgram", "section3_projectProgram", []],
  ] as const) {
    for (const mode of ["grid", "guided"] as const) {
      const { listButtons, unmount } = renderSection(entity, section, reported([...codes]), mode);
      assert.deepEqual(listButtons, [], `${entity}/${section} in ${mode} still lists its tables`);
      unmount();
    }
  }
});

// 4.6 is the one Section 4 table the adaptive renderer does not draw in
// Tableau view (vulnerable_named_rows_table is guided-only), so it fell to
// TableRenderer, which headed its question with a small bold <p> — no heading
// at all for a screen reader — and called its last row TOTAL while the five
// tables beside it called the same row TOTAL GÉNÉRAL.

/** The quiz leaves every other table closed, so the named one is the screen. */
const onlyTable = (code: string) =>
  Object.fromEntries(ALL_PP_S4.map((c) => [`${c}_RESPONSE_STATUS`, c === code ? "REPORTED" : "NONE"]));

const headings = (container: Element) =>
  [...container.querySelectorAll("h2")].map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim());

test("4.6 heads with its own question, as the five tables beside it do", () => {
  const { container, unmount } = renderSection("projectProgram", "section4_projectProgram", onlyTable("S4Q06"));
  assert.ok(
    headings(container).some((h) => /personnes vulnérables/i.test(h)),
    `4.6's question is not a heading: ${JSON.stringify(headings(container))}`,
  );
  unmount();
});

test("the grand-total row has one name, whichever renderer draws the table", () => {
  const vulnerable = renderSection("projectProgram", "section4_projectProgram", onlyTable("S4Q06"));
  // The adaptive grid puts its grand total in a <tfoot>, TableRenderer in the
  // last <tbody> row — the name is what has to agree, not the element.
  const rowHeads = (c: Element) => [...c.querySelectorAll("th")].map((th) => (th.textContent ?? "").replace(/\*$/, "").trim());
  assert.ok(rowHeads(vulnerable.container).includes("TOTAL GÉNÉRAL"), rowHeads(vulnerable.container).join(" | "));
  vulnerable.unmount();

  const permanent = renderSection("projectProgram", "section4_projectProgram", onlyTable("S4Q01"));
  assert.ok(rowHeads(permanent.container).includes("TOTAL GÉNÉRAL"), rowHeads(permanent.container).join(" | "));
  permanent.unmount();
});

// A table the official form numbers and names is headed by that name, beside
// the table, the way the form prints it (owner, 2026-10-20): the respondent who
// picks "4.2" in the table list has to land on something that says 4.2. The old
// card title was the same name with its form number stripped by
// formatCleanTitle, which did read as the question said twice.
test("each table in the column is headed by its numbered name from the form", () => {
  const { container, unmount } = renderSection(
    "projectProgram",
    "section4_projectProgram",
    reported(ALL_PP_S4),
  );
  const h = headings(container);
  for (const t of PP_SECTION4_TABLES) {
    assert.ok(h.includes(`${t.number} ${t.name.fr}`), `${t.number} does not head its table: ${JSON.stringify(h)}`);
  }
  unmount();
});

test("a table the form does not name keeps no heading of its own", () => {
  // Enterprise Section 2 is cut at the paper form's own subsections, whose
  // labels are headings; its tables carry no form-numbered name, so nothing
  // repeats the question each one already heads with.
  const { container, unmount } = renderSection(
    "enterprise",
    "section2",
    reported(["S21Q01", "S22Q01", "S22Q02", "S22Q03", "S22Q04", "S22Q05", "S23Q01", "S23Q02"]),
  );
  const h = headings(container);
  assert.ok(!h.some((x) => /^\d+\.\d+\s/.test(x)), `a table was given a number it has no name for: ${JSON.stringify(h)}`);
  unmount();
});

// Guidé is the one place a section is still walked table by table.
test("Guidé keeps one table at a time", () => {
  const guided = renderSection("projectProgram", "section4_projectProgram", reported(ALL_PP_S4), "guided");
  assert.equal(guided.mountedTables, 1, `Guidé mounts ${guided.mountedTables} tables at once`);
  guided.unmount();

  const grid = renderSection("projectProgram", "section4_projectProgram", reported(ALL_PP_S4));
  assert.equal(grid.mountedTables, 5, `Tableau mounts ${grid.mountedTables} adaptive tables`);
  grid.unmount();
});

test("Guidé heads the table with the same numbered name the column gives it", () => {
  const { container, unmount } = renderSection(
    "projectProgram",
    "section4_projectProgram",
    onlyTable("S4Q01"),
    "guided",
  );
  const h = headings(container);
  assert.ok(h.includes("4.1 Permanents recensés"), `4.1 does not head its flow: ${JSON.stringify(h)}`);
  // The number is what keeps it from being the question said twice: the
  // name without it is never drawn on its own.
  assert.ok(!h.includes("Permanents recensés"), `the unnumbered name is drawn as well: ${JSON.stringify(h)}`);
  unmount();
});
