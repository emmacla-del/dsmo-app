import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { AccessibleNumberInput } from "./AccessibleNumberInput";
import { loadMessages } from "@/test/render";

const ui = (loadMessages("fr") as { onefopUi: Record<string, string> }).onefopUi;

// AccessibleNumberInput does not refuse input itself: it passes the text on
// exactly as typed and lets field validation report it. What it must never
// do is rewrite the number (clamp "-3" to 0, floor "2.5" to 2).
function renderInput(initial = "") {
  const values: string[] = [];
  function Harness() {
    const [value, setValue] = useState<string>(initial);
    return (
      <AccessibleNumberInput
        id="n"
        value={value}
        onChange={(v) => {
          values.push(v);
          setValue(v);
        }}
      />
    );
  }
  const result = renderWithProviders(<Harness />);
  return { ...result, values, input: () => screen.getByRole("spinbutton") as HTMLInputElement };
}

test('a typed "-3" is passed on as "-3", never clamped to the minimum 0', async () => {
  const { user, values, input } = renderInput();
  await user.click(input());
  await user.paste("-3");
  assert.deepEqual(values, ["-3"]);
  assert.equal(input().value, "-3");
});

test('with "2.5" in the field the −/+ buttons are disabled instead of flooring it to 2 and stepping', async () => {
  const { user, values, input } = renderInput();
  await user.click(input());
  await user.paste("2.5");
  assert.deepEqual(values, ["2.5"]);

  const minus = screen.getByRole("button", { name: ui.decrease }) as HTMLButtonElement;
  const plus = screen.getByRole("button", { name: ui.increase }) as HTMLButtonElement;
  assert.equal(minus.disabled, true);
  assert.equal(plus.disabled, true);
  await user.click(plus);
  assert.deepEqual(values, ["2.5"], "no stepped value was committed");
});

test("+ steps a whole number and − never goes below the minimum", async () => {
  const { user, values } = renderInput("0");
  const minus = screen.getByRole("button", { name: ui.decrease }) as HTMLButtonElement;
  assert.equal(minus.disabled, true, "already at the minimum 0");

  await user.click(screen.getByRole("button", { name: ui.increase }));
  assert.deepEqual(values, ["1"]);
  await user.click(minus);
  assert.deepEqual(values, ["1", "0"]);
});
