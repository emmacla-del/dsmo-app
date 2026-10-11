import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { VtProgressiveRowGrid, isVtProgressiveNumberTable, vtNextFreeSlot, vtSpelledOutCellLabel, vtStartedSlots } from "./VtProgressiveRowGrid";
import { schemaEntity, schemaField } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

const field = schemaField("vocationalTraining", "VT4_3");

/** Renders 4.3 over a live data object, recording every write. */
function render43(initial: FormData = {}) {
  const writes: Array<[string, unknown]> = [];
  function Harness() {
    const [data, setData] = useState<FormData>(initial);
    return (
      <VtProgressiveRowGrid
        field={field}
        data={data}
        onChange={(key, value) => {
          writes.push([key, value]);
          setData((d) => ({ ...d, [key]: value }));
        }}
      />
    );
  }
  return { ...renderWithProviders(<Harness />), writes };
}

const shownSlots = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[id$="_specialtyText"]')).map((i) =>
    Number(/_row(\d+)_/.exec(i.id)![1]),
  );

test("serves the add-a-row tables of a specialty and counts", () => {
  const ids = schemaEntity("vocationalTraining")
    .sections.flatMap((s) => s.fields)
    .filter(isVtProgressiveNumberTable)
    .map((f) => f.id);
  assert.deepEqual(ids, ["VT4_3", "VT4_4", "VT4_5", "VT4_6", "VT4_10", "VT6_13", "VT8_4", "VT8_7"]);
});

test("an empty table offers its first line, and typing writes that slot", async () => {
  const { user, writes } = render43();
  assert.deepEqual(shownSlots(), [1]);
  await user.type(document.getElementById("cell-input-s4q3_row1_specialtyText")!, "Menuiserie");
  await user.type(document.getElementById("cell-input-s4q3_row1_fiMale")!, "7");
  const stored = Object.fromEntries(writes);
  assert.equal(stored.s4q3_row1_specialtyText, "Menuiserie");
  assert.equal(stored.s4q3_row1_fiMale, 7);
});

test("clearing a number stores nothing, never 0", async () => {
  const { user, writes } = render43({ s4q3_row1_specialtyText: "Menuiserie", s4q3_row1_fiMale: 7 });
  await user.clear(document.getElementById("cell-input-s4q3_row1_fiMale")!);
  assert.deepEqual(writes.at(-1), ["s4q3_row1_fiMale", null]);
});

test("FI / FC are spelled out in the header", () => {
  render43();
  const head = document.querySelector("thead")!.textContent ?? "";
  assert.match(head, /Formation initiale/);
  assert.match(head, /Formation continue/);
  assert.doesNotMatch(head, /\bFI\b|\bFC\b/);
});

test("every started slot is shown, including one with numbers but no specialty", () => {
  render43({ s4q3_row1_specialtyText: "Menuiserie", s4q3_row3_fcFemale: 2 });
  assert.deepEqual(shownSlots(), [1, 3]);
});

test("Add opens the slot after the last one used", async () => {
  const { user } = render43({ s4q3_row1_specialtyText: "A", s4q3_row3_specialtyText: "C" });
  await user.click(screen.getByRole("button", { name: "Ajouter une spécialité" }));
  assert.deepEqual(shownSlots(), [1, 3, 4]);
  assert.equal(document.activeElement?.id, "cell-input-s4q3_row4_specialtyText");
});

test("Remove clears every filled cell of its slot", async () => {
  const { user, writes } = render43({
    s4q3_row1_specialtyText: "A",
    s4q3_row2_specialtyText: "Couture",
    s4q3_row2_fiMale: 1,
    s4q3_row2_fcFemale: 0,
  });
  await user.click(screen.getByRole("button", { name: "Supprimer Couture" }));
  assert.deepEqual(writes, [
    ["s4q3_row2_specialtyText", null],
    ["s4q3_row2_fiMale", null],
    ["s4q3_row2_fcFemale", null],
  ]);
  assert.deepEqual(shownSlots(), [1]);
});

test("the column total is blank while a shown row is blank", () => {
  render43({
    s4q3_row1_specialtyText: "A", s4q3_row1_fiMale: 3, s4q3_row1_fiFemale: 1, s4q3_row1_fcMale: 0, s4q3_row1_fcFemale: 0,
    s4q3_row2_specialtyText: "B", s4q3_row2_fiMale: 2,
  });
  assert.equal(screen.getByLabelText("Total - Formation initiale - Hommes").textContent, "5");
  assert.equal(screen.getByLabelText("Total - Formation initiale - Femmes").textContent, "—");
});

test("Add is off once every slot is used", () => {
  const full: FormData = {};
  for (let i = 1; i <= 12; i++) full[`s4q3_row${i}_specialtyText`] = `S${i}`;
  render43(full);
  assert.equal((screen.getByRole("button", { name: "Ajouter une spécialité" }) as HTMLButtonElement).disabled, true);
});

test("next free slot: after the last used, else the first gap", () => {
  assert.equal(vtNextFreeSlot(field, new Set([0, 2])), 3);
  assert.equal(vtNextFreeSlot(field, new Set([0, 11])), 1);
  assert.equal(vtNextFreeSlot(field, new Set(Array.from({ length: 12 }, (_, i) => i))), null);
});

test("a cell label read on its own spells out the paper abbreviation (Guidé)", () => {
  assert.equal(vtSpelledOutCellLabel({ fr: "FI — Hommes", en: "IT — Men" }, "en"), "Initial training — Men");
  assert.equal(vtSpelledOutCellLabel({ fr: "FC — Femmes", en: "CT — Women" }, "fr"), "Formation continue — Femmes");
  assert.equal(vtSpelledOutCellLabel({ fr: "Spécialité", en: "Specialty" }, "en"), "Specialty");
});

test("4.10: each row's calculated total is shown, summed in the footer, and never stored", async () => {
  const f410 = schemaField("vocationalTraining", "VT4_10");
  const [row1, row2] = f410.table!.matrix!;
  const writes: Array<[string, unknown]> = [];
  renderWithProviders(
    <VtProgressiveRowGrid
      field={f410}
      data={{ [row1[0]]: "Couture", [row1[1]]: 3, [row1[2]]: 4, [row2[0]]: "Soudure", [row2[1]]: 2 }}
      onChange={(id, v) => writes.push([id, v])}
    />,
  );

  assert.equal(screen.getByRole("cell", { name: "Couture - Σ Total" }).textContent, "7");
  assert.equal(screen.getByRole("cell", { name: "Soudure - Σ Total" }).textContent, "—", "blank while a count is blank");
  assert.equal(screen.getByRole("cell", { name: "Total - Σ Total" }).textContent, "—");
  assert.equal(writes.length, 0);
  assert.equal(document.getElementById(`cell-input-${row1[3]}`), null, "no input for the total");
});

test("a stored total alone does not make a row started (validation's rule)", () => {
  const f410 = schemaField("vocationalTraining", "VT4_10");
  const [row1, row2] = f410.table!.matrix!;
  assert.deepEqual(vtStartedSlots(f410, { [row1[3]]: 0, [row2[1]]: 1 }), [1]);
});
