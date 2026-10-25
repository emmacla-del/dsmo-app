// Imported first: it installs jsdom before Testing Library loads.
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EntryModeSlotProvider,
  EntryModeSwitchSlot,
  useEntryModeSlot,
} from "./EntryModeSwitch";

/** The control: one button naming the other mode (owner, 2026-10-22). */
const GROUP = ".cam-mode-switch";

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

test("the bar offers the other mode, by a verb and its word", async () => {
  const { unmount } = renderWithProviders(<Chrome mode="grid" />);
  // The word stays beside the icon: a grid reads as "table", nothing reads
  // as "guided" (owner, 2026-10-12); the verb keeps it from being read as
  // the mode in use (owner, 2026-10-22).
  await waitFor(() => screen.getByRole("button", { name: "Passer en guidé" }));
  assert.equal(screen.queryByRole("button", { name: /tableau/i }), null);
  unmount();
  renderWithProviders(<Chrome mode="guided" />);
  await waitFor(() => screen.getByRole("button", { name: "Passer en tableau" }));
});

test("pressing it reports the other mode", async () => {
  const chosen: Array<"grid" | "guided"> = [];
  const { user } = renderWithProviders(
    <Chrome mode="guided" onChange={(mode) => chosen.push(mode)} />,
  );
  await user.click(await waitFor(() => screen.getByRole("button", { name: "Passer en tableau" })));
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

test("the control is named by its word, the icon is decoration", async () => {
  const { container } = renderWithProviders(<Chrome />);
  await waitFor(() => assert.ok(container.querySelector(GROUP)));
  assert.equal(container.querySelector("label"), null, "no label should wrap beside it");
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

// A phone is Guidé and nothing else (use-entry-mode.ts): offering a switch
// there would offer a mode the store refuses to return.
test("nothing is offered on a phone", async () => {
  const realMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({ ...realMatchMedia(query), matches: query.includes("max-width: 767px") })) as typeof window.matchMedia;
  try {
    const { container } = renderWithProviders(<Chrome />);
    await waitFor(() => assert.equal(container.querySelector('[data-testid="chrome"]')?.textContent, ""));
    assert.equal(container.querySelector(GROUP), null, "the control is on a phone screen");
  } finally {
    window.matchMedia = realMatchMedia;
  }
});
