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
  // code, which nothing in the backend generates.
  assert.ok(screen.getByText(/accusé de réception\s+officiel au format PDF/i));
});

test("the four phases are named with their state", () => {
  renderWithProviders(<Portal />);

  assert.ok(screen.getByText(/Phase 1 · Numérisation des circuits de collecte/));
  assert.ok(screen.getByText(/Phase 2 · Couche analytique et diffusion/));
  assert.ok(screen.getByText(/Phase 3 · Espaces dédiés/));
  assert.ok(screen.getByText(/Phase 4 · Élargissement des sources/));
  assert.ok(screen.getByText("En service"));
  assert.ok(screen.getByText("Prochaine étape"));
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
