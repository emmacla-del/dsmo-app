import { renderWithProviders, screen, within } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FieldControl } from "./FieldControl";
import { schemaField } from "@/test/schema";

function renderControl(entity: string, fieldId: string, value: unknown) {
  const field = schemaField(entity, fieldId);
  const calls: Array<[string, unknown]> = [];
  const result = renderWithProviders(
    <FieldControl field={field} value={value} onChange={(id, v) => calls.push([id, v])} locale="fr" />,
  );
  return { ...result, calls, field };
}

test("radio: an unanswered question has no option checked, and a click stores the option value", async () => {
  const { user, calls, field } = renderControl("enterprise", "S1Q03", undefined);

  const group = screen.getByRole("radiogroup");
  const radios = within(group).getAllByRole("radio");
  assert.equal(radios.length, field.options!.length);
  assert.equal(radios.filter((r) => r.getAttribute("aria-checked") === "true").length, 0);

  await user.click(within(group).getByRole("radio", { name: "Rural" }));
  assert.deepEqual(calls, [["S1Q03", "Rural/ Rural"]]);
});

test("radio: the stored value shows as checked; one element carries the field id", () => {
  const { container } = renderControl("enterprise", "S1Q03", "Urbain/ Urban");
  assert.equal(screen.getByRole("radio", { name: "Urbain" }).getAttribute("aria-checked"), "true");
  assert.equal(container.querySelectorAll("#S1Q03").length, 1);
});

test("checkbox: unticking the last option stores [] as before, not undefined", async () => {
  const field = schemaField("vocationalTraining", "VT2_27");
  const first = field.options![0].value;
  const { user, calls } = renderControl("vocationalTraining", "VT2_27", [first]);

  const box = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
  assert.equal(box.checked, true);
  await user.click(box);
  assert.deepEqual(calls, [["VT2_27", []]]);
});

test("checkbox: ticking adds to the list", async () => {
  const field = schemaField("vocationalTraining", "VT2_27");
  const [a, b] = field.options!.map((o) => o.value);
  const { user, calls } = renderControl("vocationalTraining", "VT2_27", [a]);

  await user.click(screen.getAllByRole("checkbox")[1]);
  assert.deepEqual(calls, [["VT2_27", [a, b]]]);
});
