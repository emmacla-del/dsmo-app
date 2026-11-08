// renderWithProviders first: it sets jsdom up for this file, and `screen`
// must bind to that document rather than to nothing.
import { renderWithProviders, screen, fireEvent } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { JourneyPlayer, type JourneyStep } from "./JourneyPlayer";

// The hero animation's controller. The picture and the clocks are CSS; these
// check the sequence it keeps (title card, then scene, then the next step),
// the step buttons, and the pause control (WCAG 2.2.2). The CSS clocks are
// stood in for by firing animationend on the element that carries them.

const STEPS: JourneyStep[] = [1, 2, 3].map((n) => ({
  counter: `Étape ${n} sur 3`,
  name: `Étape ${n} sur 3 : Titre ${n}`,
  title: `Titre ${n}`,
  body: `Texte ${n}`,
}));

const LABELS = {
  kicker: "Parcours",
  stage: "Animation",
  steps: "Étapes",
  pause: "Pause",
  play: "Play",
  replay: "Revoir",
  previous: "Précédente",
  next: "Suivante",
};

function renderPlayer() {
  const view = renderWithProviders(
    <JourneyPlayer steps={STEPS} labels={LABELS}>
      <div />
    </JourneyPlayer>,
  );
  const player = view.container.firstElementChild as HTMLElement;
  const stepButton = (n: number) =>
    screen.getByRole("button", { name: `Étape ${n} sur 3 : Titre ${n}` });
  const titleCard = () => player.querySelector('[data-clock="title"]');
  const sceneClock = () => player.querySelector('[data-clock="scene"]');
  return { player, stepButton, titleCard, sceneClock };
}

test("each step opens on its title card, then plays its scene, then moves on", () => {
  const { player, titleCard, sceneClock } = renderPlayer();

  assert.equal(player.dataset.scene, "1");
  assert.equal(player.dataset.phase, "title");
  assert.match(titleCard()?.textContent ?? "", /Étape 1 sur 3.*Titre 1.*Texte 1/);

  fireEvent.animationEnd(titleCard()!);
  assert.equal(player.dataset.phase, "play");
  assert.equal(titleCard(), null);

  fireEvent.animationEnd(sceneClock()!);
  assert.equal(player.dataset.scene, "2");
  assert.equal(player.dataset.phase, "title");
});

test("the story plays once and stops on its last step with « Revoir »", () => {
  const { player, titleCard, sceneClock } = renderPlayer();

  for (let i = 0; i < 3; i++) {
    fireEvent.animationEnd(titleCard()!);
    fireEvent.animationEnd(sceneClock()!);
  }
  assert.equal(player.dataset.scene, "3");
  assert.equal(player.dataset.ended, "true");
  assert.equal(screen.queryByRole("button", { name: "Pause" }), null);

  fireEvent.click(screen.getByRole("button", { name: "Revoir" }));
  assert.equal(player.dataset.scene, "1");
  assert.equal(player.dataset.phase, "title");
  assert.equal(player.hasAttribute("data-ended"), false);
});

test("a progress bar takes the viewer back to its step, from the title card", () => {
  const { player, stepButton, titleCard, sceneClock } = renderPlayer();
  fireEvent.animationEnd(titleCard()!);
  fireEvent.animationEnd(sceneClock()!);
  fireEvent.animationEnd(titleCard()!);
  assert.equal(player.dataset.scene, "2");

  fireEvent.click(stepButton(1));
  assert.equal(player.dataset.scene, "1");
  assert.equal(player.dataset.phase, "title");
  assert.equal(stepButton(1).getAttribute("aria-current"), "step");
  assert.equal(stepButton(2).hasAttribute("aria-current"), false);
  // The step chosen is announced; nothing is while it plays by itself.
  assert.match(player.querySelector('[aria-live="polite"]')?.textContent ?? "", /Titre 1/);
});

test("arrow keys and the previous/next controls move between steps", () => {
  const { player, stepButton } = renderPlayer();

  fireEvent.keyDown(stepButton(1), { key: "ArrowRight" });
  assert.equal(player.dataset.scene, "2");
  assert.equal(document.activeElement, stepButton(2));

  fireEvent.keyDown(stepButton(2), { key: "End" });
  assert.equal(player.dataset.scene, "3");
  assert.equal((screen.getByRole("button", { name: "Suivante" }) as HTMLButtonElement).disabled, true);

  fireEvent.click(screen.getByRole("button", { name: "Précédente" }));
  assert.equal(player.dataset.scene, "2");
});

test("the hero animation can be paused and played again", () => {
  const { player, stepButton } = renderPlayer();
  assert.equal(player.hasAttribute("data-paused"), false);

  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  assert.equal(player.getAttribute("data-paused"), "true");

  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  assert.equal(player.hasAttribute("data-paused"), false);

  // Choosing a step plays it, even from a pause.
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.click(stepButton(2));
  assert.equal(player.hasAttribute("data-paused"), false);
});

test("the controls sit outside the animation's role=img", () => {
  renderPlayer();
  // Inside role="img" a button would be presentational, out of reach.
  const stage = screen.getByRole("img");
  for (const button of screen.getAllByRole("button")) {
    assert.equal(stage.contains(button), false);
  }
});
