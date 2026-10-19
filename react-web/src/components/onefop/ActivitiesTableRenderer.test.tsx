import { useState } from "react";
import { renderWithProviders, screen, within } from "@/test/render";
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
  // One control per column, less the date, whose one box is a button that
  // opens the month panel rather than an input.
  assert.equal(controls, ACTIVITIES_TABLE_FIELDS.length - 1);
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
  [...container.querySelectorAll("tbody [aria-invalid='true'], tbody [data-invalid='true']")].map((el) => el.id.replace("cell-input-", "")).sort();

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
test("the box opens a panel, and a month picked there stores MM/AAAA", async () => {
  const { container, user, unmount } = renderLive({ s2_row1_description: "Formation" });
  const box = container.querySelector("#cell-input-s2_row1_startDate") as HTMLButtonElement;
  assert.equal(box.tagName, "BUTTON", "the cell is not one box");
  assert.equal(box.getAttribute("aria-expanded"), "false");
  assert.match(box.textContent ?? "", /MM\/AAAA/);

  await user.click(box);
  const panel = screen.getByRole("dialog");
  const year = within(panel).getByRole("combobox") as HTMLSelectElement;
  // Most recent first, and from the round, never the reader's clock.
  assert.deepEqual([...year.options].slice(0, 3).map((o) => o.value), ["2027", "2026", "2025"]);

  await user.selectOptions(year, "2024");
  await user.click(within(panel).getByRole("button", { name: "Mars" }));
  assert.equal(box.textContent, "Mars 2024");
  assert.equal(screen.queryByRole("dialog"), null, "the panel stayed open after a month was picked");
  unmount();
});

test("a stored date reads back in the box, and a year outside the list is kept", async () => {
  const { container, user, unmount } = renderLive({ s2_row1_startDate: "07/1960" });
  const box = container.querySelector("#cell-input-s2_row1_startDate") as HTMLButtonElement;
  assert.equal(box.textContent, "Juillet 1960");

  // A service that began before the list reaches still finds its own year.
  await user.click(box);
  const year = within(screen.getByRole("dialog")).getByRole("combobox") as HTMLSelectElement;
  assert.equal(year.value, "1960");
  unmount();
});

test("a date the line still owes says so, where a button can carry it", async () => {
  const { container, unmount } = renderLive({ s2_row1_description: "Formation" });
  // aria-invalid is not a thing on a <button>: the state is in the name and
  // in data-invalid, which globals.css draws like every other owed cell.
  const box = container.querySelector("#cell-input-s2_row1_startDate") as HTMLButtonElement;
  assert.equal(box.getAttribute("aria-invalid"), null);
  unmount();

  const { container: marked, unmount: close } = renderWithProviders(
    <ActivitiesTableRenderer
      field={schemaField("projectProgram", "PP_S2_ACTIVITIES")}
      data={{ s2_row1_description: "Formation" }}
      onChange={() => {}}
      attemptedContinue
    />,
  );
  const owed = marked.querySelector("#cell-input-s2_row1_startDate") as HTMLButtonElement;
  assert.equal(owed.getAttribute("data-invalid"), "true");
  assert.match(owed.getAttribute("aria-label") ?? "", /à renseigner$/);
  close();
});

test("Escape closes the panel and gives the box back its focus", async () => {
  const { container, user, unmount } = renderLive();
  const box = container.querySelector("#cell-input-s2_row1_startDate") as HTMLButtonElement;
  await user.click(box);
  assert.ok(screen.getByRole("dialog"));
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(document.activeElement, box);
  unmount();
});