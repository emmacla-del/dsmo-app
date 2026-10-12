# The landing page — a declaration portal at "/"

**Date:** 2026-10-12
**Status:** in progress. Phases 1–3 committed; phases 4–8 await the two open
decisions below.
**Source:** `docs/mockups/landing-camleap-canonical.html` (the owner's
reference), rendered at full scope in `docs/mockups/landing-portal-full.html`.

## Goal

Turn "/" from a bare sign-in card into the front door of the collection
layer: the routes a declarant can take, and the account of what CAMLEAP is,
what is in service and what is still to come.

## Why

The page has to serve two audiences whose needs pull apart. A declarant
under a deadline wants one thing — the route to their declaration. The
ministry, partners and the public need to understand the programme. The
settled answer is: the task owns the top of the page, the programme sits
below it, and the sign-in form moves off the landing page entirely.

## What is already committed

| Commit | What it did |
|---|---|
| `c68e9ed2` | The sign-in form moved from "/" to /login, which until then only redirected back. No behaviour change. |
| `4a5152fd` | "/" became the portal: three doors, two notices, four phases, support, footer. Copy under `portalPage.*` in `messages/*.json`. |
| `a2ee0db7` | /register reads `?type=`, so a door carries the establishment kind and step 1 does not ask again. A saved draft wins over the link. |
| `94d71bd0` | `GET /api/public/campaigns/open` — the one campaign fact an anonymous visitor may read, on its own unguarded controller. The portal shows the earliest closing date, silently omitting it on failure. |

That covers five of the nine bands and 51 message keys.

## Decisions (resolved)

- **Sign-in lives at /login.** "/" is the portal. Anonymous visitors who hit
  a protected page go to /login, not to the front door; signing out still
  returns to "/".
- **The doors carry the establishment kind** via `?type=`, using the
  `EntityType` vocabulary the registration already speaks
  (`enterprise`, `vocationalTraining`) rather than a second set of names.
- **The deadline comes from a public endpoint**, not from copy that would go
  stale. It exposes the module, the reference year and the effective closing
  date, and nothing else — no id, no code, no admin-authored name, and no
  targeting.
- **Tracking lives inside the account.** No public lookup: door 3 says so
  rather than asking for a reference no endpoint can resolve.
- **The palette is scoped to this page.** `--cam-portal-*` tokens in
  `tokens.css`; `portal.module.css` re-points the shared tokens on the
  portal's own root, so a `.cam-button` paints teal inside the portal and is
  untouched everywhere else. No `:root` token is redefined. The staff
  console, the wizards and the respondent forms keep the pure-colour system.
  Which colours the platform eventually keeps is a separate decision.
- **Colours only.** The mockup's decoration is not adopted: no tricolour
  stripe, no card rotation, no drop shadows, no large radii, no pulsing dot.
  The hero's paper → record → insight idea survives as a flat three-panel
  story.
- **Neutrals stay as they are.** The mockup's greys come from Tailwind's
  slate ramp, which rule G1 forbids as a second design system; they map onto
  the existing `--cam-text-muted` and borders instead.
- **Fonts stay.** Inter. No DM Sans, Fraunces or Space Grotesk, and no
  Tailwind CDN.
- **`--cam-focus` is not repainted.** The palette's yellow is 1.6:1 against
  cream — too weak for a focus ring. It keeps the current gold.

## Decisions (open)

1. **The hero headline.** Keep the mockup's positioning statement — "Une
   plateforme. Une vision claire de l'emploi et des compétences" — or state
   the task, as a service portal usually does. One line either way.
2. **"Obligatoire" on the employer door.** Whether the modern-sector
   declaration's mandatory status is established in the texts. It is a legal
   claim on a public page, so it stays only if it can be cited.

## Claims removed in the truth pass

The reference mockup asserts things the platform does not do. These are out,
and must stay out unless they become true:

- a tamper-proof **QR code** on the attestation — there is no QR library in
  `package.json` and `src/dsmo/pdf.service.ts` renders none; the `qrCode`
  column holds the tracking number. The wording is "accusé de réception
  officiel au format PDF, portant un numéro de suivi unique";
- the attestation being **valable pour les audits et marchés publics**;
- **free priority access** to the phase 3 benchmarking for early declarants;
- **"28 pages"**, **"12 min"**, **Horizon 2027** and **Planned (2027)**;
- **phase 2 "in development"** — it reads "prochaine étape", consistent with
  the roadmap, pending confirmation that the analytics work has restarted;
- invented contacts (`support@onefop.cm`, a landline, a city). The only
  published channel is the WhatsApp number in `messages/fr.json`.

Phase 1 is described as in service for **both** dispositifs. Confirm the
vocational-training side is genuinely open to the public before that ships.

## File layout

The mockup is the specification, not the source: none of its HTML is ported.

```
src/app/page.tsx                   renders <Portal />
src/components/landing/
  Portal.tsx                       composition only: the band sequence
  portal/
    PortalMasthead.tsx             lockup, nav tabs, sign-in, locale switcher
    PortalHero.tsx                 headline, lede, CTAs, status, story panel
    PortalDoors.tsx                the three doors + authority notice
    PortalTransformation.tsx       the four-step band + its caveat
    PortalRoadmap.tsx              status panel, filters, phase accordions
    PortalProgress.tsx             the ink band
    PortalSupport.tsx
    PortalFooter.tsx
    PortalDialog.tsx               native <dialog> for the pathway details
    portal-content.ts              doors, steps and phases as typed arrays
  portal.module.css                one stylesheet
```

Content is data, not markup: `portal-content.ts` holds key-stems and states,
each section maps over them and resolves copy through `t()`. Copy grows from
51 keys to roughly 115 in both `messages/fr.json` and `messages/en.json`.

Only `PortalRoadmap` and `PortalDialog` hold state.

`PortalDialog` duplicates about thirty lines of `AdminDialog` rather than
lifting it into a shared component, because lifting means touching the staff
console, which this work does not. Deliberate, and recorded here so it is not
read as an oversight.

## Phases

| # | What | Reviewable as |
|---|---|---|
| 4 | **Palette.** `--cam-portal-*` in tokens.css; portal.module.css re-points the shared tokens on `.page`; bands get their grounds. Repaints what exists, adds nothing. | A visual-only diff, trivial to revert |
| 5 | **Structure.** Split `Portal.tsx` into the section components and `portal-content.ts`. | A pure refactor — the 5 existing tests stay green as the proof |
| 6 | **New bands.** Masthead nav, hero story panel, transformation band, ink progress band, and their copy. | New sections only |
| 7 | **Interactivity.** Roadmap filters and accordions; pathway dialogs. | The two stateful leaves |
| 8 | **Tests and docs.** Component tests for the new bands; the UI-grammar note recording the scoped palette; this plan closed out. | Tests and docs |

One commit per phase, stopping for diff review between each. Nothing pushed.

## Constraints

- Nothing outside the landing page changes. `globals.css`, the staff console,
  the wizards and the respondent forms are not touched.
- No hex literal in TSX, and no Tailwind palette class (rule G1,
  `docs/standards/ui-grammar.md`). `npm run check:ui-grammar` covers the
  staff console only, so this page's discipline rests on review.
- `react-web` only. The Flutter client is out of scope; the backend is
  touched only by the already-committed public campaign route.
