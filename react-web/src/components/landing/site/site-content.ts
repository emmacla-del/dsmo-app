// The public site's structure, as data. The copy lives in messages/*.json
// under "site"; this file holds what is not copy: routes, order, contacts.
//
// Reference: the CAMLEAP website (2026-10-14) and docs/standards/ui-grammar.md
// §Public portal. Three pages and the way in: Accueil, Le programme,
// Assistance, Connexion.

export interface SiteRoute {
  /** Message key: site.<key>. */
  key: "navHome" | "navProgramme" | "navHelp";
  href: "/" | "/programme" | "/assistance";
}

/** The masthead's tabs, in order. The footer repeats them. */
export const SITE_NAV: SiteRoute[] = [
  { key: "navHome", href: "/" },
  { key: "navProgramme", href: "/programme" },
  { key: "navHelp", href: "/assistance" },
];

/** Every "register" button on the public site goes here. */
export const REGISTER_HREF = "/register";

/** The published support channels (owner, 2026-10-14). One place, so the
    footer, the help page and any future screen cannot disagree.
    CHECK BEFORE PUBLISHING: the WhatsApp number below is the one given for
    the website; the sign-in, registration and password-reset screens still
    publish +237 6 51 96 59 05 (messages: portalPage.helpWhatsapp). */
export const SITE_CONTACT = {
  whatsappDisplay: "+237 6 51 96 59 05",
  whatsappHref: "https://wa.me/237651965905",
  email: "camleap@minefop.cm",
} as const;

/** Home: the four phases, one line each. Message stems: site.homePhase<n>State / Title / Body. */
export const HOME_PHASES = [
  { n: 1, now: true },
  { n: 2, now: false },
  { n: 3, now: false },
  { n: 4, now: false },
] as const;

/** Programme: the four phase cards and how many bullets each carries.
    Message stems: site.progPhase<n>State / Title / Body / Item<i>. */
export const PROGRAMME_PHASES = [
  { n: 1, now: true, items: 6 },
  { n: 2, now: false, items: 4 },
  { n: 3, now: false, items: 4 },
  { n: 4, now: false, items: 3 },
] as const;

/** Help: the FAQ, in order. Message stems: site.faq<n>Question / Answer. */
export const HELP_FAQ = [1, 2, 3, 4, 5, 6] as const;
