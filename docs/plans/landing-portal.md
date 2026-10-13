# The landing page — a declaration portal at "/"

**Date:** 2026-10-12, reworked 2026-10-13
**Status:** done. Five routes, their layouts and their tests are
committed. What remains is listed under §Open.
**Source:** `docs/mockups/landing-camleap-canonical.html` (the owner's
reference for the palette), and the owner's second reference mockup of
2026-10-13 for the layout. Neither is ported as HTML.

## Goal

Turn "/" from a bare sign-in card into the front door of the collection
layer: the routes a declarant can take, and the account of what CAMLEAP is,
what is in service and what is still to come.

## Why

The page has to serve two audiences whose needs pull apart. A declarant
under a deadline wants one thing — the route to their declaration. The
ministry, partners and the public need to understand the programme. The
settled answer was: the task owns the top of the page, the programme sits
below it, and the sign-in form moves off the landing page entirely.

The 2026-10-13 rework changes the second half of that sentence. The
programme no longer sits *below* the task — it sits on its own routes
beside it, because the nav now switches the view rather than scrolling to
a band.

## What is committed

| Commit | What it did |
|---|---|
| `c68e9ed2` | The sign-in form moved from "/" to /login, which until then only redirected back. No behaviour change. |
| `4a5152fd` | "/" became the portal: three doors, two notices, four phases, support, footer. Copy under `portalPage.*` in `messages/*.json`. |
| `a2ee0db7` | /register reads `?type=`, so a door carries the establishment kind and step 1 does not ask again. A saved draft wins over the link. |
| `94d71bd0` | `GET /api/public/campaigns/open` — the one campaign fact an anonymous visitor may read, on its own unguarded controller. The portal shows the earliest closing date, silently omitting it on failure. |
| `0e67d905` | The front-door palette: `--cam-portal-*` in tokens.css, re-pointed on the portal's own root. |
| `127b3be6`, `fa4a1faf`, `c762370d` | The bands became components, their content became data, and the roadmap filters and pathway dialogs arrived. |
| `b68447e1` | **The front door became five routes.** Home took the reference mockup's own sequence. |
| `da3ef6b2` | **The four remaining views took the mockup's layout.** |
| `7cf7312f` | Nine tests over what the route split introduced. |

## Decisions (resolved)

- **Five routes, not one page.** The reference mockup switches the whole
  page from the nav. That is a route group — `/`, `/declarer`,
  `/a-propos`, `/feuille-de-route`, `/assistance` — so each view has a URL
  to share, a title in the visitor's language, and `aria-current` read
  from the pathname. The mockup fakes this by toggling a `hidden`
  attribute on five sections of one document; nothing is hidden in the DOM
  here. Decided by the owner on 2026-10-13.
- **Sign-in lives at /login.** The portal is the front door. Anonymous
  visitors who hit a protected page go to /login, not to "/"; signing out
  still returns to "/".
- **The doors carry the establishment kind** via `?type=`, using the
  `EntityType` vocabulary the registration already speaks
  (`enterprise`, `vocationalTraining`) rather than a second set of names.
- **The deadline comes from a public endpoint**, not from copy that would
  go stale. It exposes the module, the reference year and the effective
  closing date, and nothing else.
- **Tracking lives inside the account.** No public lookup: the third route
  says so rather than asking for a reference no endpoint can resolve.
- **The palette is scoped to this page.** `--cam-portal-*` tokens in
  `tokens.css`; `portal.module.css` re-points the shared tokens on the
  portal's own root, so a `.cam-button` paints teal inside the portal and
  is untouched everywhere else. No `:root` token is redefined.
- **Colours only.** The mockups' decoration is not adopted: no tricolour
  stripe, no card rotation, no drop shadows, no hover lifts, no large
  radii, no pulsing dot. The hero's paper → record idea survives as two
  flat panels and an arrow.
- **Neutrals stay as they are.** The mockups' greys come from Tailwind's
  slate ramp, which rule G1 forbids as a second design system.
- **Fonts stay.** Inter. No DM Sans, Fraunces or Space Mono, and no
  Tailwind CDN.
- **`--cam-focus` is not repainted.** The palette's yellow is 1.6:1
  against cream — too weak for a focus ring. It keeps the current gold.
- **The hero keeps the mockup's headline.** The page opens on what CAMLEAP
  is; the task is one route away, and the status line carries the deadline.
- **"Obligatoire" stays off the employer route.** The repo cites Loi
  N° 2020/010 and Loi N° 91/023, but both are about statistical secrecy
  and confidentiality, not about an obligation to declare, so nothing
  available here establishes the claim. Given a citation, the tag returns
  as "Déclaration obligatoire (arrêté n° …)", which is more use to an
  employer than the bare word ever was.
- **Stacked rows, not three cards** (2026-10-13). The reference mockup
  stacks its actions. The three routes are not a menu to compare: they are
  three answers to "which one am I", and the one that applies is read.
- **Phase cards, not accordions** (2026-10-13). Four phases at three lines
  each gained nothing from a disclosure and cost a click. The three state
  cards went with them: they were a legend for filter buttons carrying the
  same three words.
- **State on ink is light / yellow / muted** (2026-10-13), not teal. The
  portal's teal is close to invisible on `--cam-portal-ink`; the progress
  band on that same ground had already established the other vocabulary.

## What the reference mockup gets wrong

Recorded so a later pass over it does not reintroduce them:

- its pressed filter chip is filled with the band's own ink colour, which
  makes the pressed state invisible on the dark band;
- every heading carries an inline `font-size: 16px` from the editor that
  produced it, so the file does not render at its own type scale;
- it writes **CAM-LEAP**; the name is CAMLEAP, one word
  (`docs/standards/brand.md`);
- it substitutes a lettered square for the logo, where the front door
  takes the ONEFOP emblem + CAMLEAP lockup, the emblem never below 56px;
- it defaults to English; the platform's default locale is French;
- it carries both languages in the DOM and toggles them with CSS, which
  bypasses `messages/*.json` entirely;
- it opens internal links with `target="_blank"`;
- it prints a city under the support contact — see the truth pass below.

## Claims removed in the truth pass

The reference mockups assert things the platform does not do. These are
out, and must stay out unless they become true:

- a tamper-proof **QR code** on the attestation — there is no QR library in
  `package.json` and `src/dsmo/pdf.service.ts` renders none; the `qrCode`
  column holds the tracking number. The wording is "accusé de réception
  officiel au format PDF, portant un numéro de suivi unique";
- the attestation being **valable pour les audits et marchés publics**;
- **free priority access** to the phase 3 benchmarking for early declarants;
- **"28 pages"**, **"12 min"**, **Horizon 2027** and **Planned (2027)**;
- **phase 2 "in development"** — it reads "prochaine étape", consistent
  with the roadmap, pending confirmation that the analytics work has
  restarted;
- invented contacts (`support@onefop.cm`, a landline, a city). The only
  published channel is the WhatsApp number in `messages/fr.json`.

Phase 1 is described as in service for **both** dispositifs. Confirm the
vocational-training side is genuinely open to the public before that ships.

## File layout

The mockups are the specification, not the source: none of their HTML is
ported.

```
src/app/(portal)/
  layout.tsx                       masthead, skip link, <main>, footer
  page.tsx                         Home
  declarer/page.tsx                Declare
  a-propos/page.tsx                About
  feuille-de-route/page.tsx        Roadmap
  assistance/page.tsx              Support
src/components/landing/
  portal.module.css                one stylesheet
  portal/
    PortalMasthead.tsx             lockup, route tabs, sign-in, locale switch
    PortalHero.tsx                 headline, lede, actions, status, figure
    PortalStatusBand.tsx           what phase 1 does, as four claims
    PortalJourney.tsx              register → sign in → complete → submit
    PortalDeclare.tsx              the flow frame: header, routes, dock
    PortalNotices.tsx              where a declaration counts as filed
    PortalFaq.tsx                  the three questions
    PortalAbout.tsx                the programme, and the three eras
    PortalTransformation.tsx       the four-step band + its caveat
    PortalProgress.tsx             what is done and what is not (ink)
    PortalRoadmap.tsx              the four phases, filtered (ink)
    PortalSupport.tsx              the one published channel
    PortalFooter.tsx
    PortalDialog.tsx               native <dialog> for the pathway details
    PortalStatus.tsx               a state, said the same way everywhere
    portal-content.ts              routes, steps, phases as typed arrays
    portal-metadata.ts             per-route title and description
```

Content is data, not markup: `portal-content.ts` holds key-stems and
states, each section maps over them and resolves copy through `t()`. Copy
is 170 keys in both `messages/fr.json` and `messages/en.json`; key parity
is enforced by `src/lib/admin-locale.test.ts`.

Only `PortalMasthead`, `PortalDeclare`, `PortalRoadmap` and `PortalDialog`
hold state, and only those are client components. The rest render on the
server.

`PortalDialog` duplicates about thirty lines of `AdminDialog` rather than
lifting it into a shared component, because lifting means touching the
staff console, which this work does not. Deliberate, and recorded here so
it is not read as an oversight.

## Tests

`src/components/landing/portal-views.test.tsx`, 16 tests: the three routes
and their hrefs, the authority statement, the four phases and their
states, the roadmap filter and its live region, a pathway dialog opening
and closing, the deadline (present and absent), the masthead's
`aria-current` and its drawer, the footer's routes, the status claims, the
journey's order, the declaration dock, the questions, About's
collection-before-analysis line, and a filtered phase keeping its own
number.

Two of them — the phase numbering and `aria-current` — were checked
against a deliberate mutation of the code they cover.

One test is scoped rather than page-wide for a reason worth keeping: the
roadmap names the current phase in its own notice, and the copy makes that
string identical to phase 1's title, so a page-wide query matches both.

## Open

- **The eyebrows are uppercase** (`01 — ACCÈS AUX DÉMARCHES`). That is the
  mockups' idiom and the portal is consistent within itself, but it sits
  against the owner's decision of 2026-10-10 to take shouty caps out of
  the app. A copy pass should settle which wins on this page.
- **Which colours the platform eventually keeps** is still a separate
  decision. Nothing outside `portal.module.css` reads `--cam-portal-*`.
- **`landing.module.css` and `LandingShell`** still serve /login and were
  not touched by this work.

## Constraints

- Nothing outside the portal changes. `globals.css`, the staff console,
  the wizards and the respondent forms are not touched.
- No hex literal in TSX, and no Tailwind palette class (rule G1,
  `docs/standards/ui-grammar.md`). `npm run check:ui-grammar` covers the
  staff console and the registration wizard, so this page's discipline
  rests on review — and on `portal.module.css` being the only file here
  that may name a colour, through a token.
- `react-web` only. The Flutter client is out of scope; the backend is
  touched only by the already-committed public campaign route.
