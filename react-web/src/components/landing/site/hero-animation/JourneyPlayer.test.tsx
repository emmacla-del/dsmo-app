// renderWithProviders first: it sets jsdom up for this file, and `screen`
// must bind to that document rather than to nothing.
import { renderWithProviders, screen, fireEvent } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { JourneyPlayer } from "./JourneyPlayer";

// The hero animation's pause control (WCAG 2.2.2). The pausing itself is
// CSS keyed on data-paused; these check the switch and what it says.

test("the hero animation can be paused and played again", () => {
  renderWithProviders(
    <JourneyPlayer pauseLabel="Pause" playLabel="Play">
      <div role="img" aria-label="Animation" />
    </JourneyPlayer>,
  );

  const player = screen.getByRole("img").parentElement;
  assert.equal(player?.hasAttribute("data-paused"), false);

  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  assert.equal(player?.getAttribute("data-paused"), "true");

  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  assert.equal(player?.hasAttribute("data-paused"), false);
});

test("the pause control sits outside the animation's role=img", () => {
  renderWithProviders(
    <JourneyPlayer pauseLabel="Pause" playLabel="Play">
      <div role="img" aria-label="Animation" />
    </JourneyPlayer>,
  );

  // Inside role="img" a button would be presentational, out of reach.
  assert.equal(screen.getByRole("img").contains(screen.getByRole("button")), false);
});
