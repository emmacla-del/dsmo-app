// renderWithProviders first: it sets jsdom up for this file, and `screen`
// must bind to that document rather than to nothing.
import { renderWithProviders, screen, within, fireEvent, navigationMock, loadMessages } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SiteMasthead } from "./site/SiteMasthead";
import { SiteFooter } from "./site/SiteFooter";
import { HomeView } from "./site/HomeView";
import { ProgrammeView } from "./site/ProgrammeView";
import { HelpView } from "./site/HelpView";
import { SITE_CONTACT } from "./site/site-content";
import NotFound from "@/app/not-found";

// The public site (2026-10-14): Accueil, Le programme, Assistance.
//
// Expected labels come from the same catalogue the components read
// (messages/*.json, namespace "site"), so a reworded sentence does not fail
// a test; the assertions are about structure — which element, which href,
// which order. Two promises keep a literal: no payment is ever requested,
// and the receipt is an official PDF. A reword there should fail and be
// looked at.
const fr = loadMessages("fr").site as Record<string, string>;
const en = loadMessages("en").site as Record<string, string>;

test("FR and EN carry the same site keys", () => {
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
});

test("the masthead marks the page the visitor is on, and no other", () => {
  const { rerender } = renderWithProviders(<SiteMasthead />);
  navigationMock.pathname = "/programme";
  rerender(<SiteMasthead />);

  const nav = within(screen.getByRole("navigation", { name: fr.navLabel }));
  assert.equal(nav.getByRole("link", { name: fr.navProgramme }).getAttribute("aria-current"), "page");
  for (const other of [fr.navHome, fr.navHelp]) {
    assert.equal(nav.getByRole("link", { name: other }).getAttribute("aria-current"), null);
  }
});

test("on a phone, Menu opens and closes the tabs it controls", () => {
  renderWithProviders(<SiteMasthead />);

  const menu = screen.getByRole("button", { name: fr.navMenu });
  const nav = screen.getByRole("navigation", { name: fr.navLabel });
  assert.equal(menu.getAttribute("aria-controls"), nav.id);
  assert.equal(menu.getAttribute("aria-expanded"), "false");

  fireEvent.click(menu);
  assert.equal(menu.getAttribute("aria-expanded"), "true");
  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(menu.getAttribute("aria-expanded"), "false");
});

test("the masthead offers exactly three pages and the way in", () => {
  renderWithProviders(<SiteMasthead />);

  const nav = within(screen.getByRole("navigation", { name: fr.navLabel }));
  assert.deepEqual(
    nav.getAllByRole("link").map((link) => link.getAttribute("href")),
    ["/", "/programme", "/assistance"],
  );
  assert.equal(screen.getByRole("link", { name: fr.signIn }).getAttribute("href"), "/login");
});

test("home opens on two paths: register, or read about the programme", () => {
  renderWithProviders(<HomeView visual={null} />);

  assert.ok(screen.getByRole("heading", { level: 1, name: `${fr.homeH1Line1} ${fr.homeH1Line2}` }));
  // The register action appears twice (hero and closing band): both go to registration.
  for (const link of screen.getAllByRole("link", { name: fr.registerAction })) {
    assert.equal(link.getAttribute("href"), "/register");
  }
  assert.equal(screen.getByRole("link", { name: fr.homeDiscover }).getAttribute("href"), "/programme");
  // Where the pilot is open, under the buttons (it was a strip above the masthead).
  assert.ok(screen.getByText(fr.homePilotNote));
});

test("home names the three phases in order, the first one current", () => {
  renderWithProviders(<HomeView visual={null} />);

  // The hero figure repeats two of these names. The order lives in the list.
  const list = screen.getByRole("list");
  const titles = [1, 2, 3].map((n) => within(list).getByText(fr[`homePhase${n}Title`]).closest("li"));
  assert.ok(titles.every(Boolean));
  assert.match(titles[0]?.textContent ?? "", new RegExp(escape(fr.homePhase1State)));
});

test("home sends each family of respondents to its part of the help page", () => {
  renderWithProviders(<HomeView visual={null} />);

  assert.equal(
    screen.getByRole("link", { name: new RegExp(escape(fr.homeWhoEmployersTitle)) }).getAttribute("href"),
    "/assistance#employeurs",
  );
  assert.equal(
    screen.getByRole("link", { name: new RegExp(escape(fr.homeWhoCentresTitle)) }).getAttribute("href"),
    "/assistance#centres",
  );
});

test("the programme page carries why, the two pillars, the four phases, and for whom", () => {
  renderWithProviders(<ProgrammeView />);

  for (const key of ["progWhyTitle", "progPillarsTitle", "progPhasesTitle", "progForWhomTitle"]) {
    assert.ok(screen.getByRole("heading", { level: 2, name: fr[key] }), key);
  }
  for (const n of [1, 2, 3, 4]) {
    assert.ok(screen.getByRole("heading", { level: 3, name: fr[`progPhase${n}Title`] }));
  }
});

test("help lists what each family must have ready", () => {
  renderWithProviders(<HelpView />);

  assert.ok(screen.getByText(fr.helpEmployersPrepare));
  assert.ok(screen.getByText(fr.helpCentresPrepare));
  // The registration assistant's six screens, in step 1.
  for (const i of [1, 2, 3, 4, 5, 6]) assert.ok(screen.getByText(fr[`helpStep1Sub${i}`]));
});

test("help keeps the platform's two promises: no payment, an official PDF receipt", () => {
  renderWithProviders(<HelpView />);

  assert.ok(screen.getByText(/aucun paiement n['’]est demandé/i));
  assert.ok(screen.getByText(/accusé de réception officiel au format PDF/i));
});

test("the published contacts are the same on the help page and in the footer", () => {
  renderWithProviders(
    <>
      <HelpView />
      <SiteFooter />
    </>,
  );

  const whatsapp = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === SITE_CONTACT.whatsappHref);
  const email = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === `mailto:${SITE_CONTACT.email}`);
  assert.equal(whatsapp.length, 2);
  assert.equal(email.length, 2);
});

test("the footer carries the three pages and the same way in as the masthead", () => {
  renderWithProviders(<SiteFooter />);

  const nav = within(screen.getByRole("navigation", { name: fr.navLabel }));
  assert.deepEqual(
    nav.getAllByRole("link").map((link) => link.getAttribute("href")),
    ["/", "/programme", "/assistance", "/login"],
  );
  assert.equal(nav.getByRole("link", { name: fr.signIn }).getAttribute("href"), "/login");
  assert.ok(screen.getByText(fr.footerLegal));
});

test("the site says 'enquête', never 'déclaration'", () => {
  for (const [key, value] of Object.entries(fr)) {
    assert.doesNotMatch(value, /déclar/i, `site.${key}`);
  }
  for (const [key, value] of Object.entries(en)) {
    assert.doesNotMatch(value, /declar/i, `site.${key}`);
  }
});

test("not-found renders the 404 in the site's chrome, in French", () => {
  renderWithProviders(<NotFound />);

  // Scoped to <main>: the masthead and footer also link to "Assistance".
  const main = within(screen.getByRole("main"));
  assert.ok(main.getByText("404"));
  assert.ok(main.getByRole("heading", { level: 1, name: "Page introuvable" }));
  assert.equal(main.getByRole("link", { name: "Retour à l'accueil" }).getAttribute("href"), "/");
  assert.equal(main.getByRole("link", { name: "Assistance" }).getAttribute("href"), "/assistance");
});

test("not-found renders the 404 in English", () => {
  renderWithProviders(<NotFound />, { locale: "en" });

  const main = within(screen.getByRole("main"));
  assert.ok(main.getByRole("heading", { level: 1, name: "Page not found" }));
  assert.equal(main.getByRole("link", { name: "Return home" }).getAttribute("href"), "/");
  assert.equal(main.getByRole("link", { name: "Help" }).getAttribute("href"), "/assistance");
});

/** A message string used inside a RegExp: its punctuation is not a pattern. */
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
