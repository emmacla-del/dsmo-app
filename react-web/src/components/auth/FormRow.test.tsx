import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FormRow } from "./FormRow";

// Defect 19 (2026-10-16 VT run) reported the VTC type, education system and
// centre status selects as named by their chosen option. They are named by
// their FormRow label whatever is chosen; the option is their value.
test("a select keeps its label as its name once a value is chosen", () => {
  renderWithProviders(
    <FormRow htmlFor="reg-entity-cfpType" label="VTC type" required>
      <select id="reg-entity-cfpType" value="public" onChange={() => {}}>
        <option value=""></option>
        <option value="public">Public</option>
      </select>
    </FormRow>,
    { locale: "en" },
  );
  const select = screen.getByRole("combobox", { name: "VTC type" }) as HTMLSelectElement;
  assert.equal(select.value, "public");
});
