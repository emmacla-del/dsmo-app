import { renderWithProviders, screen, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VtWizardProgressiveBooleanTableEntry,
  VtWizardProgressiveGuidedTableEntry,
  VtWizardRosterGuidedEntry,
} from "./VtWizardGuidedEntry";
import { schemaField } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

// 5.2 "Référentiel de formation": a progressive table whose first cell is the
// specialty and whose other cells are Oui/Non (hasCurriculum, isApproved).
const Q52 = "VT5_5";

function render52(data: FormData = {}) {
  const field = schemaField("vocationalTraining", Q52);
  const calls: Array<[string, unknown]> = [];
  const result = renderWithProviders(
    <VtWizardProgressiveBooleanTableEntry field={field} data={data} onChange={(id, v) => calls.push([id, v])} />,
  );
  return { ...result, calls, field };
}

test("5.2 renders its Oui/Non answer as a native radio group with nothing checked", () => {
  render52();

  const group = screen.getByRole("group", { name: /Existence d'un référentiel de formation/ });
  const radios = within(group).getAllByRole("radio");
  assert.deepEqual(radios.map((r) => (r as HTMLInputElement).type), ["radio", "radio"]);
  assert.equal(new Set(radios.map((r) => (r as HTMLInputElement).name)).size, 1, "options share one name");
  assert.ok(within(group).getByRole("radio", { name: "Oui" }));
  assert.ok(within(group).getByRole("radio", { name: "Non" }));
  assert.equal(radios.filter((r) => (r as HTMLInputElement).checked).length, 0, "unanswered: no default selection");
});

test("clicking the Oui label selects it, and the stored value is the string \"true\" as before", async () => {
  const { user, calls, field } = render52();
  const vt = field.table!.vt!;
  const row1 = vt.rows[0].id;

  await user.type(screen.getByRole("textbox", { name: /Spécialité/ }), "Menuiserie");
  const group = screen.getByRole("group", { name: /Existence d'un référentiel de formation/ });
  await user.click(within(group).getByText("Oui"));
  assert.equal((within(group).getByRole("radio", { name: "Oui" }) as HTMLInputElement).checked, true);
  assert.equal((within(group).getByRole("radio", { name: "Non" }) as HTMLInputElement).checked, false);

  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  const written = Object.fromEntries(calls);
  assert.equal(written[`${row1}_specialtyText`], "Menuiserie");
  assert.equal(written[`${row1}_hasCurriculum`], "true");
  // The follow-up question was never answered: it is written as null, not "false".
  for (const cell of vt.cells.slice(2)) {
    assert.equal(written[`${row1}_${cell.key}`], null);
  }
});

test("5.2 summary rows: edit/delete buttons name the row, and an unanswered cell is not shown as Non", () => {
  const field = schemaField("vocationalTraining", Q52);
  const row1 = field.table!.vt!.rows[0].id;
  render52({ [`${row1}_specialtyText`]: "Menuiserie", [`${row1}_hasCurriculum`]: "true" });

  const edit = screen.getByRole("button", { name: "Modifier la ligne 1 : Menuiserie" });
  const remove = screen.getByRole("button", { name: "Supprimer la ligne 1 : Menuiserie" });
  for (const button of [edit, remove]) {
    const glyph = button.querySelector("span");
    assert.equal(glyph?.getAttribute("aria-hidden"), "true");
  }
  assert.equal(screen.queryByText(/: Non\b/), null, "unanswered isApproved must not read as Non");
  assert.ok(screen.getByText(/Existence d'un référentiel de formation : Oui/));
});

test("4.10 guided-table summary buttons name the row by its position and specialty", () => {
  const field = schemaField("vocationalTraining", "VT4_10");
  const row2 = field.table!.vt!.rows[1].id;
  renderWithProviders(
    <VtWizardProgressiveGuidedTableEntry
      field={field}
      data={{ [`${row2}_specialtyText`]: "Couture", [`${row2}_male`]: 3, [`${row2}_female`]: 4 }}
      onChange={() => {}}
    />,
  );
  assert.ok(screen.getByRole("button", { name: "Modifier la ligne 2 : Couture" }));
  assert.ok(screen.getByRole("button", { name: "Supprimer la ligne 2 : Couture" }));
});

test("8.8 roster summary buttons name the trainer, in English too", () => {
  const field = schemaField("vocationalTraining", "VT8_8");
  const row1 = field.table!.vt!.rows[0].id;
  renderWithProviders(
    <VtWizardRosterGuidedEntry
      field={field}
      data={{ [`${row1}_lastName`]: "Ndi", [`${row1}_firstName`]: "Paul" }}
      onChange={() => {}}
    />,
    { locale: "en" },
  );
  assert.ok(screen.getByRole("button", { name: "Edit row 1: Ndi Paul" }));
  assert.ok(screen.getByRole("button", { name: "Delete row 1: Ndi Paul" }));
});
