import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { VtWizardField } from "./VtWizardFields";
import { schemaField } from "@/test/schema";
import type { OnefopField } from "@/lib/onefop-schema";

// VT1_1-VT1_7 text fields render the region/department suggestion chips,
// which read the territory tree through React Query: seeded empty, no fetch.
const NO_TERRITORY: Array<[readonly unknown[], unknown]> = [[["locations", "structure"], []]];

function renderField(field: OnefopField, props: { value?: unknown; errorMessage?: string; onChange?: (id: string, v: unknown) => void } = {}) {
  const calls: Array<[string, unknown]> = [];
  const onChange = props.onChange ?? ((id: string, v: unknown) => calls.push([id, v]));
  const result = renderWithProviders(
    <VtWizardField field={field} value={props.value ?? ""} onChange={onChange} sectionId="section1" errorMessage={props.errorMessage} />,
    { queryData: NO_TERRITORY },
  );
  return { ...result, calls };
}

/** The <label> text of a field rendered with htmlFor={field.id}. */
function labelTextOf(container: HTMLElement, fieldId: string): string {
  const label = container.querySelector(`label[for="${fieldId}"]`);
  assert.ok(label, `no <label for="${fieldId}">`);
  return label.textContent ?? "";
}

test("an optional question (1.3 Sigle) is marked (facultatif) and is not aria-required", () => {
  const field = schemaField("vocationalTraining", "VT1_3");
  assert.equal(field.required, false, "schema precondition: VT1_3 is optional");
  const { container } = renderField(field);

  assert.match(labelTextOf(container, "VT1_3"), /\(facultatif\)/);
  const input = screen.getByRole("textbox", { name: /Sigle/ });
  assert.equal(input.getAttribute("aria-required"), null);
});

test("a required question (1.15 Noms et prénoms) carries no (facultatif) mark and is aria-required", () => {
  const field = schemaField("vocationalTraining", "VT1_15_NAME");
  assert.equal(field.required, true, "schema precondition: VT1_15_NAME is required");
  const { container } = renderField(field);

  assert.doesNotMatch(labelTextOf(container, "VT1_15_NAME"), /facultatif/);
  const input = screen.getByRole("textbox", { name: /Noms et prénoms/ });
  assert.equal(input.getAttribute("aria-required"), "true");
});

test("a required radio question (1.9 Milieu) exposes aria-required on its radio group and has no (facultatif) mark", () => {
  const field = schemaField("vocationalTraining", "VT1_9");
  renderField(field);

  const group = screen.getByRole("radiogroup", { name: /Milieu d'implantation/ });
  assert.equal(group.getAttribute("aria-required"), "true");
  assert.equal(screen.queryByText(/facultatif/), null);
});

test("without an error, the control is described by its hint only and is not aria-invalid", () => {
  const field = schemaField("vocationalTraining", "VT1_15_NAME");
  renderField(field);

  const input = screen.getByRole("textbox", { name: /Noms et prénoms/ });
  assert.equal(input.getAttribute("aria-describedby"), "VT1_15_NAME-hint");
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(document.getElementById("VT1_15_NAME-hint")?.textContent, "Ex: Jean Dupont");
});

test("an error message is linked to the control with aria-describedby, error first, then the hint", () => {
  const field = schemaField("vocationalTraining", "VT1_15_NAME");
  renderField(field, { errorMessage: "Ce champ est obligatoire" });

  const input = screen.getByRole("textbox", { name: /Noms et prénoms/ });
  assert.equal(input.getAttribute("aria-invalid"), "true");
  const ids = (input.getAttribute("aria-describedby") ?? "").split(/\s+/);
  assert.deepEqual(ids, ["VT1_15_NAME-error", "VT1_15_NAME-hint"]);

  const error = document.getElementById(ids[0]);
  assert.ok(error, "the error element referenced by aria-describedby exists");
  assert.match(error.textContent ?? "", /Ce champ est obligatoire/);
  assert.equal(error.getAttribute("role"), "alert");
  assert.equal(document.getElementById(ids[1])?.textContent, "Ex: Jean Dupont");
  // What a screen reader announces as the description.
  assert.match(screen.getByRole("textbox", { description: /Ce champ est obligatoire/ }).id, /^VT1_15_NAME$/);
});

test("1.1 Code de la Structure is read-only, shows its value, ignores typing and is not marked optional", async () => {
  const field = schemaField("vocationalTraining", "VT1_1");
  const { container, user, calls } = renderField(field, { value: "CFP-0042" });

  const input = screen.getByRole("textbox", { name: /Code de la Structure/ }) as HTMLInputElement;
  assert.equal(input.readOnly, true);
  assert.equal(input.getAttribute("aria-readonly"), "true");
  assert.equal(input.value, "CFP-0042");

  await user.type(input, "XYZ");
  assert.equal(input.value, "CFP-0042");
  assert.deepEqual(calls, [], "typing in 1.1 never reaches onChange");

  // VT1_1 is optional in the schema but is an administrative code, not a
  // question the respondent may skip: no (facultatif).
  assert.doesNotMatch(labelTextOf(container, "VT1_1"), /facultatif/);
});

test("typing in an ordinary text question reports each value through onChange", async () => {
  const field = schemaField("vocationalTraining", "VT1_3");
  const { user, calls } = renderField(field);

  await user.type(screen.getByRole("textbox", { name: /Sigle/ }), "C");
  assert.deepEqual(calls, [["VT1_3", "C"]]);
});
