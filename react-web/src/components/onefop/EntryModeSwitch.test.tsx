// Imported first: it installs jsdom before Testing Library loads.
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EntryModeSlotProvider,
  EntryModeSwitchSlot,
  useEntryModeSlot,
} from "./EntryModeSwitch";

/** A wizard chrome: the slot row above, the screen's control below. */
function Chrome({ mode = "grid" as "grid" | "guided" }) {
  const slot = useEntryModeSlot();
  return (
    <EntryModeSlotProvider element={slot.element}>
      <header data-testid="chrome">{slot.row}</header>
      <main data-testid="screen">
        <EntryModeSwitchSlot mode={mode} onChange={() => {}} />
      </main>
    </EntryModeSlotProvider>
  );
}

test("the control renders in the chrome's slot, not beside the table", async () => {
  const { container } = renderWithProviders(<Chrome />);
  const select = await waitFor(() => {
    const el = container.querySelector("select");
    assert.ok(el, "the control never reached the slot");
    return el;
  });
  assert.ok(
    select.closest('[data-testid="chrome"]'),
    "the control must sit in the chrome",
  );
  assert.equal(
    select.closest('[data-testid="screen"]'),
    null,
    "the control must not stay beside the table",
  );
});

test("the chosen mode is the one shown", async () => {
  renderWithProviders(<Chrome mode="guided" />);
  await waitFor(() => {
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    assert.equal(select.value, "guided");
  });
});

/** A screen with several tables: each one renders the slot. */
function ChromeWithTables({ tables }: { tables: number }) {
  const slot = useEntryModeSlot();
  return (
    <EntryModeSlotProvider element={slot.element}>
      <header data-testid="chrome">{slot.row}</header>
      <main>
        {Array.from({ length: tables }, (_, i) => (
          <EntryModeSwitchSlot key={i} mode="grid" onChange={() => {}} />
        ))}
      </main>
    </EntryModeSlotProvider>
  );
}

test("several tables on one screen still put one control in the bar", async () => {
  const { container } = renderWithProviders(<ChromeWithTables tables={3} />);
  await waitFor(() => {
    assert.ok(container.querySelector("select"), "no control reached the bar");
  });
  assert.equal(
    container.querySelectorAll("select").length,
    1,
    "each table drew its own selector in the app bar",
  );
});

test("the control carries its name without a visible label", async () => {
  const { container } = renderWithProviders(<Chrome />);
  const select = await waitFor(() => {
    const el = container.querySelector("select");
    assert.ok(el);
    return el;
  });
  assert.ok(select.getAttribute("aria-label"), "the control must still be named");
  assert.equal(container.querySelector("label"), null, "no label should wrap beside it");
});

test("without a chrome the control still renders where it stands", () => {
  const { container } = renderWithProviders(
    <EntryModeSwitchSlot mode="grid" onChange={() => {}} />,
  );
  assert.ok(container.querySelector("select"), "no provider must not swallow the control");
});
