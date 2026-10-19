import { useState } from "react";
import { renderWithProviders, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaField } from "@/test/schema";
import { ActivitiesTableRenderer } from "./ActivitiesTableRenderer";
import { ACTIVITIES_TABLE_FIELDS } from "@/lib/onefop-activities";

// PP_S2_ACTIVITIES has thirteen row slots. It used to render all thirteen
// at once — seventy-eight empty controls on a first visit — although a row
// half filled is an error (validateActivitiesTable). The respondent adds
// the lines they need, as in the training-centre tables.

function renderTable(data: Record<string, unknown> = {}, attemptedContinue = false) {
  const changes: Array<[string, unknown]> = [];
  const result = renderWithProviders(
    <ActivitiesTableRenderer
      field={schemaField("projectProgram", "PP_S2_ACTIVITIES")}
      data={data}
      onChange={(id, value) => changes.push([id, value])}
      attemptedContinue={attemptedContinue}
    />,
  );
  return {
    ...result,
    changes,
    rows: result.container.querySelectorAll("tbody tr").length,
    controls: result.container.querySelectorAll("tbody input, tbody select").length,
  };
}

test("an empty table offers one line, not thirteen", () => {
  const { rows, controls, unmount } = renderTable();
  assert.equal(rows, 1);
  // One control per column, and one more: « Date de début » is a month and a
  // year side by side.
  assert.equal(controls, ACTIVITIES_TABLE_FIELDS.length + 1);
  unmount();
});

test("every line the respondent started is on screen", () => {
  const { rows, unmount } = renderTable({
    s2_row1_description: "Formation",
    s2_row3_description: "Appui financier",
  });
  assert.equal(rows, 2);
  unmount();
});

test("Add a line opens the next one and keeps the ones already shown", async () => {
  const { container, user, unmount } = renderTable();
  const q = within(container);
  await user.click(q.getByRole("button", { name: "Ajouter une ligne" }));
  assert.equal(container.querySelectorAll("tbody tr").length, 2);
  await user.click(q.getByRole("button", { name: "Ajouter une ligne" }));
  assert.equal(container.querySelectorAll("tbody tr").length, 3);
  unmount();
});

test("Add a line stops at the table's capacity", () => {
  const started = Object.fromEntries(
    Array.from({ length: 13 }, (_, i) => [`s2_row${i + 1}_description`, `Prestation ${i + 1}`]),
  );
  const { container, rows, unmount } = renderTable(started);
  assert.equal(rows, 13);
  const add = within(container).getByRole("button", { name: "Ajouter une ligne" }) as HTMLButtonElement;
  assert.equal(add.disabled, true);
  unmount();
});

test("Remove empties the line's cells rather than leaving a half-filled row", async () => {
  const { container, user, changes, unmount } = renderTable({
    s2_row1_description: "Formation",
    s2_row1_targetPopulation: "3",
  });
  await user.click(within(container).getByRole("button", { name: "Supprimer la ligne 1" }));
  assert.deepEqual(
    changes.sort(),
    [
      ["s2_row1_description", ""],
      ["s2_row1_targetPopulation", ""],
    ].sort(),
  );
  unmount();
});

test("the table's question is a heading, and every cell has a name", () => {
  const { container, unmount } = renderTable();
  assert.equal(container.querySelectorAll("h2").length, 1);
  const named = [...container.querySelectorAll("tbody input, tbody select")].every((el) =>
    (el.getAttribute("aria-label") ?? "").length > 3,
  );
  assert.ok(named, "a cell has no accessible name");
  unmount();
});

// The error state the other tables have had all along: validation refuses a
// half-filled line (missingActivitiesCells), and the summary named the field
// while nothing on the grid was marked — this table was passed no
// attemptedContinue at all.
const invalidCells = (container: Element) =>
  [...container.querySelectorAll("tbody [aria-invalid='true']")].map((el) => el.id.replace("cell-input-", "")).sort();

test("a half-filled line marks the boxes it still owes, once Continue was pressed", () => {
  const half = { s2_row1_description: "Formation" };
  const before = renderTable(half);
  assert.deepEqual(invalidCells(before.container), [], "marked before the respondent pressed Continue");
  before.unmount();

  const after = renderTable(half, true);
  assert.deepEqual(invalidCells(after.container), [
    "s2_row1_duration",
    "s2_row1_scope",
    "s2_row1_startDate",
    // Both halves of the date are marked, not just the month.
    "s2_row1_startDate-year",
    "s2_row1_supportType",
    "s2_row1_targetPopulation",
  ]);
  after.unmount();
});

test("a line nobody started is never marked, however many are open", () => {
  const { container, unmount } = renderTable({}, true);
  assert.deepEqual(invalidCells(container), []);
  unmount();
});

// « 1 ligne(s) sur 13 » — the parenthetical plural the wizard avoids
// everywhere else (vt-progress-plural.test.tsx).
test("the line counter is a real plural", () => {
  const one = renderTable();
  assert.match(one.container.textContent ?? "", /1 ligne sur 13 au maximum/);
  one.unmount();

  const two = renderTable({ s2_row1_description: "A", s2_row2_description: "B" });
  assert.match(two.container.textContent ?? "", /2 lignes sur 13 au maximum/);
  two.unmount();
});

/** The wizard's own loop: what onChange writes comes back as the value. The
 *  flat renderTable above keeps its data still, which is enough for one
 *  keystroke but not for an answer typed character by character. */
function LiveTable({ initial }: { initial: Record<string, unknown> }) {
  const [data, setData] = useState<Record<string, unknown>>(initial);
  return (
    <ActivitiesTableRenderer
      field={schemaField("projectProgram", "PP_S2_ACTIVITIES")}
      data={data}
      onChange={(id, value) => setData((d) => ({ ...d, [id]: value }))}
    />
  );
}

function renderLive(initial: Record<string, unknown> = {}) {
  const result = renderWithProviders(<LiveTable initial={initial} />);
  const cell = (id: string) => result.container.querySelector(`#cell-input-${id}`) as HTMLInputElement;
  return { ...result, cell, stored: () => cell("s2_row1_startDate") };
}

// « Date de début » asks for a month and a year, and nothing more. A calendar
// (type="date") would have the respondent pick a day the form does not ask for;
// a month input leaves the year behind an arrow, one click per year. So: the
// month is chosen from a list, the year typed, and MM/AAAA is what is stored.
test("the month is picked and the year typed, and MM/AAAA is stored", async () => {
  const { container, user, unmount } = renderLive({ s2_row1_description: "Formation" });
  const month = container.querySelector("#cell-input-s2_row1_startDate") as HTMLSelectElement;
  const year = container.querySelector("#cell-input-s2_row1_startDate-year") as HTMLInputElement;
  assert.equal(month.tagName, "SELECT");
  assert.ok([...month.options].some((o) => o.textContent === "Mars"), "the months are not named");

  await user.selectOptions(month, "03");
  await user.type(year, "2026");
  assert.equal(month.value, "03");
  assert.equal(year.value, "2026");
  unmount();
});

test("a stored date fills both halves, and the year takes digits only", async () => {
  const { container, user, unmount } = renderLive({ s2_row1_startDate: "03/2026" });
  const month = container.querySelector("#cell-input-s2_row1_startDate") as HTMLSelectElement;
  const year = container.querySelector("#cell-input-s2_row1_startDate-year") as HTMLInputElement;
  assert.equal(month.value, "03");
  assert.equal(year.value, "2026");
  assert.equal(year.maxLength, 4);

  await user.clear(year);
  await user.type(year, "a1");
  assert.equal(year.value, "1", "a letter reached the year box");
  unmount();
});
