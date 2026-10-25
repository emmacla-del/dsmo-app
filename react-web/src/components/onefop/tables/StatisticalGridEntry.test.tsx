import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { StatisticalGridRenderer } from "./StatisticalGridRenderer";
import { buildSection41Definition } from "./StatisticalTableDefinition";
import { schemaField } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

// VT 4.1 (learners by academic diploma × sex): two typed columns, a
// calculated Total column and a TOTAL GÉNÉRAL foot — the shape the entry
// aids are built for.
const definition = buildSection41Definition(schemaField("vocationalTraining", "VT4_1"));
const rows = definition.rows;
const cellKey = (rowIdx: number, col: "male" | "female") => rows[rowIdx].cells[col].fieldKey;

/** The grid with the state the wizard would hold for it. */
function Harness({ initial = {} as FormData }: { initial?: FormData }) {
  const [data, setData] = useState<FormData>(initial);
  return (
    <StatisticalGridRenderer
      definition={definition}
      data={data}
      onChange={(key, value) => setData((d) => ({ ...d, [key]: value }))}
      onBatchChange={(updates) => setData((d) => ({ ...d, ...updates }))}
    />
  );
}

const cell = (fieldKey: string) =>
  document.querySelector<HTMLInputElement>(`input[data-field-key="${fieldKey}"]`)!;

/* ── What is left to fill ────────────────────────────────────────────── */

test("the bar says how many cells are still empty, and goes to the first one", async () => {
  const { user } = renderWithProviders(<Harness initial={{ [cellKey(0, "male")]: 4 }} />);
  const typed = rows.length * 2;
  assert.match(
    screen.getByText(new RegExp(`cellules vides sur ${typed}`)).textContent!,
    new RegExp(`^${typed - 1} cellules vides sur ${typed}\\.$`),
  );

  await user.click(screen.getByRole("button", { name: "Aller à la première cellule vide" }));
  // The first blank is read row by row: row 1's "Femmes", the male cell being filled.
  assert.equal(document.activeElement, cell(cellKey(0, "female")));
});

test("once every cell is answered the bar says so and offers nothing", () => {
  const full: FormData = {};
  for (let i = 0; i < rows.length; i++) {
    full[cellKey(i, "male")] = 0;
    full[cellKey(i, "female")] = 0;
  }
  renderWithProviders(<Harness initial={full} />);
  screen.getByText("Toutes les cellules de ce tableau sont remplies.");
  assert.equal(screen.queryByRole("button", { name: "Aller à la première cellule vide" }), null);
  assert.equal(screen.queryByRole("button", { name: /Mettre 0/ }), null);
});

/* ── Pasting a block from a spreadsheet ──────────────────────────────── */

test("a block pasted at the focused cell fills the cells right and down", async () => {
  const { user } = renderWithProviders(<Harness />);
  await user.click(cell(cellKey(0, "male")));
  await user.paste("1\t2\n3\t4");

  assert.equal(cell(cellKey(0, "male")).value, "1");
  assert.equal(cell(cellKey(0, "female")).value, "2");
  assert.equal(cell(cellKey(1, "male")).value, "3");
  assert.equal(cell(cellKey(1, "female")).value, "4");
  screen.getByText("4 cellules remplies");
});

test("a pasted block leaves the row totals as typing would", async () => {
  // 4.1 declares no recalc of its own: its row totals are kept by the
  // renderer as each cell is typed, and a paste must keep them the same way.
  const { user } = renderWithProviders(<Harness />);
  await user.click(cell(cellKey(0, "male")));
  await user.paste("1\t2\n3\t4");

  const total = (rowIdx: number) =>
    screen.getByLabelText(`${rows[rowIdx].label.fr} - Total (Total calculé)`).textContent;
  assert.equal(total(0), "3");
  assert.equal(total(1), "7");
});

test("a pasted value that is not a whole count is refused and reported", async () => {
  const { user } = renderWithProviders(<Harness />);
  await user.click(cell(cellKey(0, "male")));
  await user.paste("5\t2,5");

  assert.equal(cell(cellKey(0, "male")).value, "5");
  assert.equal(cell(cellKey(0, "female")).value, "");
  screen.getByText(/1 valeur refusée \(un nombre entier est attendu\)/);
});

test("a paste leaves the calculated Total column as it is", async () => {
  const { user } = renderWithProviders(<Harness />);
  await user.click(cell(cellKey(0, "male")));
  await user.paste("1\t2\t99");
  screen.getByText(/1 cellule calculée laissée telle quelle/);
});

/* ── Typing: a count is digits only ──────────────────────────────────── */

test("a decimal point, a sign and a letter are refused at the keystroke", async () => {
  const { user } = renderWithProviders(<Harness />);
  const input = cell(cellKey(0, "male"));
  await user.click(input);
  await user.type(input, "1.5");
  assert.equal(input.value, "15");
  // The refusal is said rather than swallowed: "1,5" becoming 15 silently
  // would be a tenfold error nobody could see.
  screen.getByText("Les cellules de ce tableau n'acceptent que des nombres entiers.");

  await user.clear(input);
  await user.type(input, "-3e2x");
  assert.equal(input.value, "32");
});

/* ── Putting 0 in the empty rows, and undoing it ─────────────────────── */

test("the empty rows are zeroed, a part-filled row is left alone, and undo restores the blanks", async () => {
  const { user } = renderWithProviders(<Harness initial={{ [cellKey(0, "male")]: 7 }} />);

  // Every row but the first is wholly blank.
  await user.click(screen.getByRole("button", { name: `Mettre 0 dans les ${rows.length - 1} lignes vides` }));
  assert.equal(cell(cellKey(1, "male")).value, "0");
  assert.equal(cell(cellKey(1, "female")).value, "0");
  // The row holding a figure keeps its blank: that cell is the respondent's to answer.
  assert.equal(cell(cellKey(0, "female")).value, "");
  screen.getByText(`${rows.length - 1} lignes mises à 0.`);

  await user.click(screen.getByRole("button", { name: "Annuler" }));
  assert.equal(cell(cellKey(1, "male")).value, "");
  assert.equal(cell(cellKey(1, "female")).value, "");
  assert.equal(cell(cellKey(0, "male")).value, "7");
  screen.getByText("Modification annulée.");
});

/* ── The respondent's own check total ────────────────────────────────── */

test("the check total reports the gap with the table's own total", async () => {
  // The foot's Total column adds up the stored row totals, which the wizard
  // materialises as the cells are typed; the test writes them the same way.
  const full: FormData = {};
  for (let i = 0; i < rows.length; i++) {
    const male = i === 0 ? 10 : 0;
    full[cellKey(i, "male")] = male;
    full[cellKey(i, "female")] = 0;
    full[rows[i].cells.total.fieldKey] = male;
  }
  const { user } = renderWithProviders(<Harness initial={full} />);

  const field = screen.getByLabelText("Vérification (hors questionnaire) — total attendu :");
  await user.type(field, "12");
  screen.getByText("Écart de 2 avec le total du tableau (10).");

  await user.clear(field);
  await user.type(field, "10");
  screen.getByText("Correspond au total du tableau.");
});

test("the check total is an entry aid: it writes nothing into the declaration", async () => {
  const written: string[] = [];
  function Watched() {
    const [data, setData] = useState<FormData>({});
    return (
      <StatisticalGridRenderer
        definition={definition}
        data={data}
        onChange={(key, value) => {
          written.push(key);
          setData((d) => ({ ...d, [key]: value }));
        }}
        onBatchChange={(updates) => {
          written.push(...Object.keys(updates));
          setData((d) => ({ ...d, ...updates }));
        }}
      />
    );
  }
  const { user } = renderWithProviders(<Watched />);
  await user.type(screen.getByLabelText("Vérification (hors questionnaire) — total attendu :"), "40");
  assert.deepEqual(written, []);
});
