// Imported first: it installs jsdom before Testing Library loads.
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EntryModeSlotProvider,
  EntryModeSwitchSlot,
  useEntryModeSlot,
} from "./EntryModeSwitch";

/** The control: a group of two toggle buttons, one per mode. */
const GROUP = '[role="group"]';

/** A wizard chrome: the slot row above, the screen's control below. */
function Chrome({
  mode = "grid" as "grid" | "guided",
  onChange = () => {},
}: {
  mode?: "grid" | "guided";
  onChange?: (mode: "grid" | "guided") => void;
}) {
  const slot = useEntryModeSlot();
  return (
    <EntryModeSlotProvider element={slot.element}>
      <header data-testid="chrome">{slot.row}</header>
      <main data-testid="screen">
        <EntryModeSwitchSlot mode={mode} onChange={onChange} />
      </main>
    </EntryModeSlotProvider>
  );
}

test("the control renders in the chrome's slot, not beside the table", async () => {
  const { container } = renderWithProviders(<Chrome />);
  const group = await waitFor(() => {
    const el = container.querySelector(GROUP);
    assert.ok(el, "the control never reached the slot");
    return el;
  });
  assert.ok(
    group.closest('[data-testid="chrome"]'),
    "the control must sit in the chrome",
  );
  assert.equal(
    group.closest('[data-testid="screen"]'),
    null,
    "the control must not stay beside the table",
  );
});

test("both modes are on the bar, each named by its word, the chosen one pressed", async () => {
  renderWithProviders(<Chrome mode="guided" />);
  // The word stays beside the icon: a grid reads as "table", nothing reads
  // as "guided" (owner, 2026-10-12).
  const grid = await waitFor(() => screen.getByRole("button", { name: "Tableau" }));
  const guided = screen.getByRole("button", { name: "Guidé" });
  assert.equal(guided.getAttribute("aria-pressed"), "true");
  assert.equal(grid.getAttribute("aria-pressed"), "false");
});

test("pressing the other mode reports it", async () => {
  const chosen: Array<"grid" | "guided"> = [];
  const { user } = renderWithProviders(
    <Chrome mode="guided" onChange={(mode) => chosen.push(mode)} />,
  );
  const grid = await waitFor(() => screen.getByRole("button", { name: "Tableau" }));
  await user.click(grid);
  assert.deepEqual(chosen, ["grid"]);
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
    assert.ok(container.querySelector(GROUP), "no control reached the bar");
  });
  assert.equal(
    container.querySelectorAll(GROUP).length,
    1,
    "each table drew its own selector in the app bar",
  );
});

test("the control carries its name without a visible label", async () => {
  const { container } = renderWithProviders(<Chrome />);
  const group = await waitFor(() => {
    const el = container.querySelector(GROUP);
    assert.ok(el);
    return el;
  });
  assert.equal(
    group.getAttribute("aria-label"),
    "Mode de saisie",
    "the group must still be named for a screen reader",
  );
  assert.equal(container.querySelector("label"), null, "no label should wrap beside it");
  // The icons are decoration: each button is already named by its word.
  for (const svg of container.querySelectorAll("svg")) {
    assert.equal(svg.getAttribute("aria-hidden"), "true");
  }
});

test("without a chrome the control still renders where it stands", () => {
  const { container } = renderWithProviders(
    <EntryModeSwitchSlot mode="grid" onChange={() => {}} />,
  );
  assert.ok(container.querySelector(GROUP), "no provider must not swallow the control");
});
