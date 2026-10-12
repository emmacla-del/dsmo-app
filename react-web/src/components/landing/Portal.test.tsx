// renderWithProviders first: it sets jsdom up for this file, and `screen`
// must bind to that document rather than to nothing.
import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Portal } from "./Portal";
import type { OpenCampaign } from "@/lib/api-client";

const OPEN_CAMPAIGNS: [unknown[], OpenCampaign[]][] = [
  [
    ["public-campaigns-open"],
    [
      { collectionType: "ONEFOP", referenceYear: 2026, closesOn: "2026-06-30T00:00:00.000Z" },
      { collectionType: "DSMO", referenceYear: 2025, closesOn: "2026-03-31T00:00:00.000Z" },
    ],
  ],
];

test("the front door offers all three routes, with the declaration kind in the link", () => {
  renderWithProviders(<Portal />);

  // The two declaration doors carry the establishment kind, so step 1 of the
  // registration does not ask again (src/app/register/page.tsx).
  assert.equal(
    screen.getByRole("link", { name: "Télédéclarer mon entreprise" }).getAttribute("href"),
    "/register?type=enterprise",
  );
  assert.equal(
    screen.getByRole("link", { name: "Déclarer mon établissement" }).getAttribute("href"),
    "/register?type=vocationalTraining",
  );
  // Tracking lives inside the account; the door says so rather than asking
  // for a reference no public endpoint can resolve.
  assert.equal(
    screen.getByRole("link", { name: "Accéder à mon espace" }).getAttribute("href"),
    "/login",
  );
});

test("the authority statement is on the page, in both its parts", () => {
  renderWithProviders(<Portal />);

  assert.ok(
    screen.getByText(/seules les déclarations transmises par CAMLEAP/i),
    "the anti-fraud statement must be on the front door",
  );
  assert.ok(screen.getByText(/aucun paiement n'est demandé/i));
  // What the platform actually issues: a PDF with a tracking number. Not a QR
  // code, which nothing in the backend generates. Scoped to the notice, since
  // the employer pathway's dialog states the same deliverable — a visitor
  // never sees both at once, so that is not duplication on the page.
  const receipt = screen.getByText(/Accusé de réception\s*:/).closest("div");
  assert.ok(
    receipt && /officiel au format PDF/i.test(receipt.textContent ?? ""),
    "the receipt notice must say what the platform actually issues",
  );
});

test("the four phases are named, each carrying its own state", () => {
  renderWithProviders(<Portal />);

  // Scoped to the phase rather than to the page: the roadmap's filter buttons
  // are labelled with the same state names on purpose, so "En service" exists
  // twice over and a bare getByText would be ambiguous.
  const stateOf = (title: RegExp) => {
    const phase = screen.getByText(title).closest("li");
    assert.ok(phase, `phase not found: ${title}`);
    return phase.textContent ?? "";
  };

  assert.match(stateOf(/Phase 1 · Numérisation des circuits de collecte/), /En service/);
  assert.match(stateOf(/Phase 2 · Couche analytique et diffusion/), /Prochaine étape/);
  assert.match(stateOf(/Phase 3 · Espaces dédiés/), /Planifié/);
  assert.match(stateOf(/Phase 4 · Élargissement des sources/), /Vision/);
});

test("a roadmap filter narrows the phases and says so", async () => {
  const { user } = renderWithProviders(<Portal />);

  assert.equal(screen.getAllByRole("group", { name: "Filtrer les étapes" }).length, 1);
  await user.click(screen.getByRole("button", { name: "Prochaine étape" }));

  // Only phase 2 is "next", so the other three leave the list.
  assert.equal(screen.queryByText(/Phase 1 · Numérisation/), null);
  assert.ok(screen.getByText(/Phase 2 · Couche analytique/));
  assert.equal(screen.queryByText(/Phase 4 · Élargissement/), null);
  // Filtering has no visible control state of its own to announce, so the
  // count goes through a live region.
  assert.match(screen.getByRole("status").textContent ?? "", /1 étape affichée/);
});

test("a pathway dialog opens with what that route involves, and closes again", async () => {
  const { user } = renderWithProviders(<Portal />);

  const dialog = () =>
    document.querySelector("dialog[aria-labelledby='portal-dialog-door2']") as HTMLDialogElement;

  assert.equal(dialog().open, false, "dialogs start closed");

  await user.click(
    screen.getByRole("button", {
      name: /Détails du parcours : Centres de formation professionnelle/,
    }),
  );
  assert.equal(dialog().open, true);
  assert.match(dialog().textContent ?? "", /Référence d'agrément MINEFOP requise/);

  await user.click(screen.getAllByRole("button", { name: "Fermer" })[0]);
  assert.equal(dialog().open, false);
});

test("with no campaign data the page says collection is open and names no date", () => {
  renderWithProviders(<Portal />);

  assert.ok(screen.getByText(/la collecte numérique est ouverte/));
  // The endpoint may be unreachable, or not deployed yet. Silence beats a
  // date the page invented, and the visitor must never see an error here.
  assert.equal(screen.queryByText(/Prochaine clôture/), null);
});

test("the earliest closing date among the open collections is shown", () => {
  renderWithProviders(<Portal />, { queryData: OPEN_CAMPAIGNS });

  // 31 March, not 30 June: the next one to close, whichever collection it is.
  assert.ok(screen.getByText(/Prochaine clôture\s*:\s*31 mars 2026/));
});
