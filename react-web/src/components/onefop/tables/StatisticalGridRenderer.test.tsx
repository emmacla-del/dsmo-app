import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { StatisticalGridRenderer } from "./StatisticalGridRenderer";
import { buildSection41Definition } from "./StatisticalTableDefinition";
import { schemaField } from "@/test/schema";
import type { FormData } from "@/lib/onefop-schema";

// VT 4.1 (learners by academic diploma x sex) has `hasTotalRow` but no stored
// total row: its TOTAL GÉNÉRAL footer is the column sum of the body rows.
const definition = buildSection41Definition(schemaField("vocationalTraining", "VT4_1"));

/** Every 4.1 cell at 0, then the given overrides (row totals materialised). */
function filled(overrides: Record<string, number | null> = {}): FormData {
  const data: FormData = {};
  for (const row of definition.rows) {
    const male = row.cells.male.fieldKey;
    const female = row.cells.female.fieldKey;
    data[male] = male in overrides ? overrides[male] : 0;
    data[female] = female in overrides ? overrides[female] : 0;
    const m = data[male] as number | null;
    const f = data[female] as number | null;
    data[row.cells.total.fieldKey] = m === null || f === null ? null : m + f;
  }
  return data;
}

const footer = () =>
  ["Homme", "Femme", "Σ Total"].map(
    (col) => screen.getByLabelText(`${col} (Total calculé)`).textContent,
  );

test("4.1 TOTAL GÉNÉRAL sums each column over the diploma rows", () => {
  const data = filled({ s4q1_bepc_male: 25, s4q1_bepc_female: 20, s4q1_cep_male: 15, s4q1_cep_female: 12 });
  renderWithProviders(<StatisticalGridRenderer definition={definition} data={data} onChange={() => {}} />);
  assert.deepEqual(footer(), ["40", "32", "72"]);
});

test("4.1 TOTAL GÉNÉRAL stays blank for a column with a blank cell (blank is not 0)", () => {
  const data = filled({ s4q1_bepc_male: 25, s4q1_licence_female: null });
  renderWithProviders(<StatisticalGridRenderer definition={definition} data={data} onChange={() => {}} />);
  assert.deepEqual(footer(), ["25", "—", "—"]);
});
