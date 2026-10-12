import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { VT85_FIELD_IDS, Vt85StatusTable } from "./Vt85StatusTable";
import { ENTRY_MODE_STORAGE_KEY, type EntryMode } from "@/lib/use-entry-mode";
import { schemaEntity } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

const SIX = new Set<string>(VT85_FIELD_IDS);

/** Renders 8.5 over a live data object in the given entry mode, recording every write. */
function render85(mode: EntryMode, initial: FormData = {}, issueMessages = new Map<string, string>()) {
  window.localStorage.setItem(ENTRY_MODE_STORAGE_KEY, mode);
  const writes: Array<[string, unknown]> = [];
  function Harness() {
    const [data, setData] = useState<FormData>(initial);
    return (
      <Vt85StatusTable
        data={data}
        onChange={(key, value) => {
          writes.push([key, value]);
          setData((d) => ({ ...d, [key]: value }));
        }}
        issueMessages={issueMessages}
      />
    );
  }
  return { ...renderWithProviders(<Harness />), writes };
}

test("the six 8.5 ids are the schema's 8.5 number fields", () => {
  const ids = schemaEntity("vocationalTraining")
    .sections.flatMap((s) => s.fields)
    .filter((f) => f.paperCode === "8.5")
    .map((f) => f.id);
  assert.deepEqual(ids, [...VT85_FIELD_IDS]);
});

test("Tableau: a cell writes its own field and no total", async () => {
  const { user, writes } = render85("grid", { VT8_5_VP_F: 2 });
  await user.type(document.getElementById("cell-input-VT8_5_VP_M") as HTMLInputElement, "3");

  assert.ok(writes.length > 0);
  assert.ok(writes.every(([key]) => SIX.has(key)), `only the six fields: ${JSON.stringify(writes)}`);
  assert.deepEqual(writes.at(-1), ["VT8_5_VP_M", 3]);
});

test("Tableau: row totals are shown from the six fields, blank when a row is empty", () => {
  render85("grid", { VT8_5_VP_M: 3, VT8_5_VP_F: 2 });
  const rowTotal = (row: string) =>
    screen.getByLabelText(`${row} - Total (Total calculé)`).textContent;
  assert.equal(rowTotal("Formateurs vacataires professionnels"), "5");
  assert.equal(rowTotal("Formateurs Permanents"), "—");
  // No total input: the total column is computed, not typed.
  assert.equal(document.getElementById("cell-input-VT8_5_VP_TOTAL"), null);
});

test("Guidé: a total and its women save men and women only", async () => {
  const { user, writes } = render85("guided");
  await user.type(screen.getAllByRole("textbox", { name: "Nombre total" })[0], "5");
  await user.type(screen.getByRole("textbox", { name: "Parmi eux, combien de femmes ?" }), "2");

  assert.ok(writes.every(([key]) => SIX.has(key)), `only the six fields: ${JSON.stringify(writes)}`);
  const stored = Object.fromEntries(writes);
  assert.equal(stored.VT8_5_VP_M, 3);
  assert.equal(stored.VT8_5_VP_F, 2);
});

test("issues are listed under the table, and the wrapper carries the first issue's id", () => {
  const issues = new Map([
    ["VT8_5_VNP_F", "Renseignez ce champ."],
    ["VT8_5_VP_M", "8.5 compte 6 hommes, mais le tableau 8.1 en compte 5."],
  ]);
  render85("guided", {}, issues);
  const alert = screen.getByRole("alert");
  assert.match(alert.textContent ?? "", /8\.5 compte 6 hommes/);
  assert.match(alert.textContent ?? "", /Renseignez ce champ/);
  assert.ok(document.getElementById("field-VT8_5_VP_M"), "first issue in table order is VP_M");
});
