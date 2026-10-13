// renderWithProviders first: it sets jsdom up for this file, and `screen`
// must bind to that document rather than to nothing.
import { renderWithProviders, screen, fireEvent, within, navigationMock } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PortalHero } from "./portal/PortalHero";
import { PortalDeclare } from "./portal/PortalDeclare";
import { PortalNotices } from "./portal/PortalNotices";
import { PortalRoadmap } from "./portal/PortalRoadmap";
import { PortalMasthead } from "./portal/PortalMasthead";
import { PortalFooter } from "./portal/PortalFooter";
import { PortalStatusBand } from "./portal/PortalStatusBand";
import { PortalJourney } from "./portal/PortalJourney";
import { PortalFaq } from "./portal/PortalFaq";
import { PortalAbout } from "./portal/PortalAbout";
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

test("Declare states the prerequisite, then branches on first time vs returning", () => {
  renderWithProviders(<PortalDeclare />);

  // No entity submits without an account, so the page says so before it
  // offers anything — the reason signing in is not a third pathway here.
  assert.ok(screen.getByText(/L'inscription et la connexion sont obligatoires/));

  // First time: the two registration routes, each carrying the establishment
  // kind so step 1 of the registration does not ask again
  // (src/app/register/page.tsx).
  assert.ok(screen.getByRole("heading", { name: "Première déclaration ?" }));
  assert.equal(
    screen.getByRole("link", { name: "Télédéclarer mon entreprise" }).getAttribute("href"),
    "/register?type=enterprise",
  );
  assert.equal(
    screen.getByRole("link", { name: "Déclarer mon établissement" }).getAttribute("href"),
    "/register?type=vocationalTraining",
  );

  // Already registered: one line and one secondary action, not a route card
  // dressed as a third kind of journey.
  assert.ok(screen.getByRole("heading", { name: "Déjà inscrit ?" }));
  assert.equal(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href"), "/login");
  assert.equal(screen.queryByRole("link", { name: "Accéder à mon espace" }), null);
});

test("the authority statement is on the page, in both its parts", () => {
  renderWithProviders(<PortalNotices />);

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
  renderWithProviders(<PortalRoadmap />);

  // Scoped to the phase rather than to the page: the roadmap's filter buttons
  // are labelled with the same state names on purpose, so "En service" exists
  // twice over and a bare getByText would be ambiguous.
  const stateOf = (title: RegExp) => {
    const elements = screen.getAllByText(title);
    const phase = elements.map(el => el.closest("li")).find(Boolean);
    assert.ok(phase, `phase not found: ${title}`);
    return phase.textContent ?? "";
  };

  assert.match(stateOf(/Phase 1 · Numérisation des circuits de collecte/), /En service/);
  assert.match(stateOf(/Phase 2 · Couche analytique et diffusion/), /Prochaine étape/);
  assert.match(stateOf(/Phase 3 · Espaces dédiés/), /Planifié/);
  assert.match(stateOf(/Phase 4 · Élargissement des sources/), /Vision/);
});

test("a roadmap filter narrows the phases and says so", () => {
  renderWithProviders(<PortalRoadmap />);

  assert.equal(screen.getAllByRole("group", { name: "Filtrer les étapes" }).length, 1);
  fireEvent.click(screen.getByRole("button", { name: "Prochaine étape" }));

  // Scoped to the phase list: the band also names the current phase in its
  // own notice, which is phase 1 and stays there whatever the filter says.
  const phases = within(screen.getByRole("list", { name: "Phases du programme" }));
  // Only phase 2 is "next", so the other three leave the list.
  assert.equal(phases.queryByText(/Phase 1 · Numérisation/), null);
  assert.ok(phases.getByText(/Phase 2 · Couche analytique/));
  assert.equal(phases.queryByText(/Phase 4 · Élargissement/), null);
  // Filtering has no visible control state of its own to announce, so the
  // count goes through a live region.
  assert.match(screen.getByRole("status").textContent ?? "", /1 étape affichée/);
});

test("a pathway dialog opens with what that route involves, and closes again", async () => {
  const { user } = renderWithProviders(<PortalDeclare />);

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
  renderWithProviders(<PortalHero />);

  assert.ok(screen.getByText(/la collecte numérique est ouverte/));
  // The endpoint may be unreachable, or not deployed yet. Silence beats a
  // date the page invented, and the visitor must never see an error here.
  assert.equal(screen.queryByText(/Prochaine clôture/), null);
});

test("the earliest closing date among the open collections is shown", () => {
  renderWithProviders(<PortalHero />, { queryData: OPEN_CAMPAIGNS });

  // 31 March, not 30 June: the next one to close, whichever collection it is.
  assert.ok(screen.getByText(/Prochaine clôture\s*:\s*31 mars 2026/));
});

// ── The views the five routes are made of ──────────────────────────────────

test("the masthead marks the route the visitor is on, and no other", () => {
  // renderWithProviders resets the navigation state, so the pathname is set
  // after the first render and the masthead is rendered again against it.
  const { rerender } = renderWithProviders(<PortalMasthead />);
  navigationMock.pathname = "/declarer";
  rerender(<PortalMasthead />);

  const nav = within(screen.getByRole("navigation", { name: "Navigation principale" }));
  // aria-current is read from the pathname, not from a scroll observer: the
  // views are routes, so "which one am I in" is a fact the router knows.
  assert.equal(nav.getByRole("link", { name: "Déclarer" }).getAttribute("aria-current"), "page");
  for (const other of ["Accueil", "Feuille de route", "Assistance"]) {
    assert.equal(nav.getByRole("link", { name: other }).getAttribute("aria-current"), null);
  }
});

test("the masthead's menu opens the same four routes on a narrow viewport", async () => {
  const { user } = renderWithProviders(<PortalMasthead />);

  // Closed, there is one nav; the toggle says what it will do.
  assert.equal(screen.getAllByRole("navigation", { name: "Navigation principale" }).length, 1);
  const toggle = screen.getByRole("button", { name: "Ouvrir le menu" });
  assert.equal(toggle.getAttribute("aria-expanded"), "false");

  await user.click(toggle);

  assert.equal(screen.getAllByRole("navigation", { name: "Navigation principale" }).length, 2);
  assert.equal(screen.getByRole("button", { name: "Fermer le menu" }).getAttribute("aria-expanded"), "true");
  // The drawer is the same links, not a second navigation with its own ideas.
  assert.equal(screen.getAllByRole("link", { name: "Feuille de route" }).length, 2);
});

test("the footer carries every route, including the one the masthead leaves out", () => {
  renderWithProviders(<PortalFooter />);

  const nav = within(screen.getByRole("navigation", { name: "Navigation principale" }));
  for (const label of ["Accueil", "Déclarer", "Feuille de route", "Assistance"]) {
    assert.ok(nav.getByRole("link", { name: label }));
  }
  // About is reached from the hero and from here: it explains the programme,
  // which is not a task a visitor arrives to do.
  assert.equal(nav.getByRole("link", { name: "À propos" }).getAttribute("href"), "/a-propos");
});

test("the status band states what phase 1 does, and that there is no public lookup", () => {
  renderWithProviders(<PortalStatusBand />);

  assert.ok(screen.getByText("La télédéclaration de la phase 1 est en service"));
  assert.ok(screen.getByText(/Un brouillon peut être enregistré, puis repris/));
  // The claim the platform is most often asked about: tracking lives inside
  // the account, because no public endpoint resolves a reference.
  assert.ok(screen.getByText(/il n'existe aucune recherche publique/));
});

test("the journey is four numbered steps, in the order a declarant meets them", () => {
  renderWithProviders(<PortalJourney />);

  const steps = within(screen.getByRole("heading", { name: "Comment ça marche" }).closest("div")!)
    .getAllByRole("listitem");
  assert.equal(steps.length, 4);
  assert.match(steps[0].textContent ?? "", /^01S'inscrire/);
  assert.match(steps[3].textContent ?? "", /^04Soumettre/);
  // The band ends on the task itself.
  assert.equal(
    screen.getByRole("link", { name: "Choisir votre parcours" }).getAttribute("href"),
    "/declarer",
  );
});

test("the declaration frame ends on the way back and the way to help", () => {
  renderWithProviders(<PortalDeclare />);

  assert.equal(screen.getByRole("link", { name: "Retour à l'accueil" }).getAttribute("href"), "/");
  assert.equal(
    screen.getByRole("link", { name: "Obtenir de l'aide" }).getAttribute("href"),
    "/assistance",
  );
});

test("the questions are answered, and the answer to the obligatory one is yes", () => {
  renderWithProviders(<PortalFaq />);

  assert.ok(screen.getByRole("heading", { name: "Questions fréquentes" }));
  assert.equal(screen.getAllByRole("group").length, 3);
  // Closed <details> keeps its content in the DOM, so the answer is readable
  // without opening it — what matters is that it is the true one.
  assert.match(
    screen.getByText("L'inscription est-elle obligatoire ?").closest("details")?.textContent ?? "",
    /Aucune soumission anonyme n'est possible/,
  );
});

test("About says collection comes first, and names the three eras", () => {
  renderWithProviders(<PortalAbout />);

  assert.ok(screen.getByRole("heading", { name: "Du papier à un observatoire numérique" }));
  // The LMIS/observatory distinction (CLAUDE.md §4): the panel must not read
  // as a promise of dashboards the collection has not yet fed.
  const panel = screen.getByRole("heading", { name: "Collecter d'abord, analyser ensuite" }).closest("div");
  assert.match(panel?.textContent ?? "", /l'observatoire lit ensuite ce qu'il contient/);

  const eras = within(screen.getByRole("heading", { name: "Du papier à la statistique" }).closest("div")!)
    .getAllByRole("listitem");
  assert.equal(eras.length, 3);
  assert.match(eras[1].textContent ?? "", /Dossier numérique \(En service\)/);
});

test("a filtered phase keeps its own number, not its position in the filtered list", () => {
  renderWithProviders(<PortalRoadmap />);

  fireEvent.click(screen.getByRole("button", { name: "Planifiées" }));

  const phases = within(screen.getByRole("list", { name: "Phases du programme" })).getAllByRole("listitem");
  assert.equal(phases.length, 2);
  // Phases 3 and 4, numbered 03 and 04 — not 01 and 02, which is what a
  // running index over the filtered list would have printed.
  assert.match(phases[0].textContent ?? "", /^03Phase 3/);
  assert.match(phases[1].textContent ?? "", /^04Phase 4/);
});
